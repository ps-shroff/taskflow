const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/projects — list projects user belongs to
router.get('/', authenticate, async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: req.user.id },
          { members: { some: { userId: req.user.id } } },
          ...(req.user.role === 'ADMIN' ? [{}] : [])
        ]
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true, members: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(projects);
  } catch (err) { next(err); }
});

// POST /api/projects — create project (any authenticated user)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const project = await prisma.project.create({
      data: {
        name,
        description,
        ownerId: req.user.id,
        members: {
          create: { userId: req.user.id, role: 'ADMIN' }
        }
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true, members: true } }
      }
    });
    res.status(201).json(project);
  } catch (err) { next(err); }
});

// GET /api/projects/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } }
        },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            creator: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isMember = project.members.some(m => m.userId === req.user.id);
    const isOwner = project.ownerId === req.user.id;
    if (!isMember && !isOwner && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(project);
  } catch (err) { next(err); }
});

// PUT /api/projects/:id — update project (owner or admin)
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: id } }
    });

    if (project.ownerId !== req.user.id && membership?.role !== 'ADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only project owner or admin can update' });
    }

    const { name, description, status } = req.body;
    const updated = await prisma.project.update({
      where: { id },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(status && { status }) },
      include: { owner: { select: { id: true, name: true, email: true } } }
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id — only owner or global admin
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (project.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only the project owner can delete it' });
    }

    await prisma.project.delete({ where: { id } });
    res.json({ message: 'Project deleted' });
  } catch (err) { next(err); }
});

// POST /api/projects/:id/members — add member (project admin/owner)
router.post('/:id/members', authenticate, async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);
    const { userId, role } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId } }
    });

    if (project.ownerId !== req.user.id && membership?.role !== 'ADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only project admin can add members' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const member = await prisma.projectMember.upsert({
      where: { userId_projectId: { userId: parseInt(userId), projectId } },
      create: { userId: parseInt(userId), projectId, role: role || 'MEMBER' },
      update: { role: role || 'MEMBER' },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    res.status(201).json(member);
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id/members/:userId — remove member
router.delete('/:id/members/:userId', authenticate, async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId } }
    });

    const canManage = project.ownerId === req.user.id || membership?.role === 'ADMIN' || req.user.role === 'ADMIN';
    const isSelf = req.user.id === targetUserId;

    if (!canManage && !isSelf) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.projectMember.delete({
      where: { userId_projectId: { userId: targetUserId, projectId } }
    });
    res.json({ message: 'Member removed' });
  } catch (err) { next(err); }
});

module.exports = router;

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

const checkProjectAccess = async (projectId, userId, userRole) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: 'Project not found', status: 404 };

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } }
  });

  if (!membership && project.ownerId !== userId && userRole !== 'ADMIN') {
    return { error: 'Not a project member', status: 403 };
  }
  return { project, membership };
};

// GET /api/tasks?projectId=X — get tasks for a project
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { projectId, status, assigneeId, priority } = req.query;

    if (!projectId) {
      // Return all tasks user can see
      const tasks = await prisma.task.findMany({
        where: {
          OR: [
            { assigneeId: req.user.id },
            { creatorId: req.user.id },
            { project: { members: { some: { userId: req.user.id } } } },
            { project: { ownerId: req.user.id } },
            ...(req.user.role === 'ADMIN' ? [{}] : [])
          ],
          ...(status && { status }),
          ...(priority && { priority }),
          ...(assigneeId && { assigneeId: parseInt(assigneeId) })
        },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(tasks);
    }

    const pid = parseInt(projectId);
    const access = await checkProjectAccess(pid, req.user.id, req.user.role);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const tasks = await prisma.task.findMany({
      where: {
        projectId: pid,
        ...(status && { status }),
        ...(priority && { priority }),
        ...(assigneeId && { assigneeId: parseInt(assigneeId) })
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
  } catch (err) { next(err); }
});

// POST /api/tasks — create task
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { title, description, projectId, assigneeId, priority, dueDate, status } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const pid = parseInt(projectId);
    const access = await checkProjectAccess(pid, req.user.id, req.user.role);
    if (access.error) return res.status(access.status).json({ error: access.error });

    // Validate assignee is a member
    if (assigneeId) {
      const assigneeMembership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: parseInt(assigneeId), projectId: pid } }
      });
      if (!assigneeMembership) {
        return res.status(400).json({ error: 'Assignee must be a project member' });
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        projectId: pid,
        creatorId: req.user.id,
        assigneeId: assigneeId ? parseInt(assigneeId) : null,
        priority: priority || 'MEDIUM',
        status: status || 'TODO',
        dueDate: dueDate ? new Date(dueDate) : null
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } }
      }
    });
    res.status(201).json(task);
  } catch (err) { next(err); }
});

// GET /api/tasks/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } }
      }
    });

    if (!task) return res.status(404).json({ error: 'Task not found' });

    const access = await checkProjectAccess(task.projectId, req.user.id, req.user.role);
    if (access.error) return res.status(access.status).json({ error: access.error });

    res.json(task);
  } catch (err) { next(err); }
});

// PUT /api/tasks/:id — update task
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const access = await checkProjectAccess(task.projectId, req.user.id, req.user.role);
    if (access.error) return res.status(access.status).json({ error: access.error });

    // Members can only update status of their own assigned tasks
    // Admins/project-admins/creator can update everything
    const isProjectAdmin = access.project?.ownerId === req.user.id ||
      access.membership?.role === 'ADMIN' || req.user.role === 'ADMIN';
    const isCreator = task.creatorId === req.user.id;
    const isAssignee = task.assigneeId === req.user.id;

    if (!isProjectAdmin && !isCreator && !isAssignee) {
      return res.status(403).json({ error: 'Insufficient permissions to update this task' });
    }

    const { title, description, status, priority, assigneeId, dueDate } = req.body;
    const updateData = {};

    if (isProjectAdmin || isCreator) {
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (priority !== undefined) updateData.priority = priority;
      if (assigneeId !== undefined) updateData.assigneeId = assigneeId ? parseInt(assigneeId) : null;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }
    if (status !== undefined) updateData.status = status;

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } }
      }
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/tasks/:id — only creator, project admin, or global admin
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const access = await checkProjectAccess(task.projectId, req.user.id, req.user.role);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const isProjectAdmin = access.project?.ownerId === req.user.id ||
      access.membership?.role === 'ADMIN' || req.user.role === 'ADMIN';

    if (!isProjectAdmin && task.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only task creator or project admin can delete tasks' });
    }

    await prisma.task.delete({ where: { id } });
    res.json({ message: 'Task deleted' });
  } catch (err) { next(err); }
});

module.exports = router;

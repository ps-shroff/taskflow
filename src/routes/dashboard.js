const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/dashboard — summary stats for current user
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    const now = new Date();

    // Projects user is part of
    const projectWhere = isAdmin ? {} : {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } }
      ]
    };

    const [
      totalProjects,
      totalTasks,
      myTasks,
      tasksByStatus,
      overdueTasks,
      recentTasks,
      myProjects
    ] = await Promise.all([
      prisma.project.count({ where: projectWhere }),

      prisma.task.count({
        where: isAdmin ? {} : {
          project: projectWhere
        }
      }),

      prisma.task.count({ where: { assigneeId: userId } }),

      prisma.task.groupBy({
        by: ['status'],
        _count: { status: true },
        where: isAdmin ? {} : { project: projectWhere }
      }),

      prisma.task.count({
        where: {
          dueDate: { lt: now },
          status: { not: 'DONE' },
          ...(isAdmin ? {} : {
            OR: [
              { assigneeId: userId },
              { project: projectWhere }
            ]
          })
        }
      }),

      prisma.task.findMany({
        where: isAdmin ? {} : {
          OR: [
            { assigneeId: userId },
            { creatorId: userId }
          ]
        },
        include: {
          assignee: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 5
      }),

      prisma.project.findMany({
        where: projectWhere,
        include: {
          _count: { select: { tasks: true, members: true } },
          tasks: {
            where: { status: { not: 'DONE' } },
            select: { id: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 4
      })
    ]);

    const statusMap = {};
    tasksByStatus.forEach(s => { statusMap[s.status] = s._count.status; });

    res.json({
      stats: {
        totalProjects,
        totalTasks,
        myTasks,
        overdueTasks,
        todo: statusMap['TODO'] || 0,
        inProgress: statusMap['IN_PROGRESS'] || 0,
        done: statusMap['DONE'] || 0
      },
      recentTasks,
      myProjects
    });
  } catch (err) { next(err); }
});

module.exports = router;

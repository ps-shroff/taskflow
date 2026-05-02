const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/users — list all users (authenticated, for member assignment)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (err) { next(err); }
});

// PUT /api/users/:id/role — change user role (global admin only)
router.put('/:id/role', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { role } = req.body;

    if (!['ADMIN', 'MEMBER'].includes(role)) {
      return res.status(400).json({ error: 'Role must be ADMIN or MEMBER' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true }
    });
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;

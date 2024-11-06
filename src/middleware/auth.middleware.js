const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find teacher
    const teacher = await prisma.teacher.findUnique({
      where: { id: decoded.teacherId }
    });

    if (!teacher) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Add teacher to request object
    req.teacher = teacher;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication required' });
  }
}; 
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if teacher already exists
    const existingTeacher = await prisma.teacher.findUnique({
      where: { email }
    });

    if (existingTeacher) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create teacher
    const teacher = await prisma.teacher.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    });

    res.status(201).json({
      message: 'Teacher registered successfully',
      teacher: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find teacher
    const teacher = await prisma.teacher.findUnique({
      where: { email }
    });

    if (!teacher) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, teacher.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { teacherId: teacher.id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
}; 
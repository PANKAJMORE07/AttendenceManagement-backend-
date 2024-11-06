const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // First, clear existing data
  await prisma.attendance.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.subject.deleteMany({});

  // Create TY students
  const tyStudents = await Promise.all([
    prisma.student.create({
      data: { name: 'John Doe', rollNo: 1, class: 'TY' }
    }),
    prisma.student.create({
      data: { name: 'Jane Smith', rollNo: 2, class: 'TY' }
    }),
    prisma.student.create({
      data: { name: 'Alice Johnson', rollNo: 3, class: 'TY' }
    }),
    prisma.student.create({
      data: { name: 'Bob Wilson', rollNo: 4, class: 'TY' }
    }),
    prisma.student.create({
      data: { name: 'Charlie Brown', rollNo: 5, class: 'TY' }
    })
  ]);

  // Create TY subjects
  const tySubjects = await Promise.all([
    prisma.subject.create({
      data: { name: 'Database', class: 'TY' }
    }),
    prisma.subject.create({
      data: { name: 'TOC', class: 'TY' }
    }),
    prisma.subject.create({
      data: { name: 'SE', class: 'TY' }
    })
  ]);

  console.log('Seed data created:', { 
    students: tyStudents, 
    subjects: tySubjects 
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
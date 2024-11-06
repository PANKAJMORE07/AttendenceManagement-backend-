const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const prisma = new PrismaClient();

exports.markAttendance = async (req, res) => {
  try {
    const { date, time, subjectId, attendanceData, className } = req.body;

    console.log('Received request for:', {
      subjectId,
      className,
      date,
      time
    });

    // Get subject details first with strict check
    const subject = await prisma.subject.findUnique({
      where: { 
        id: parseInt(subjectId) // Ensure subjectId is a number
      }
    });

    if (!subject) {
      throw new Error(`Subject not found for ID: ${subjectId}`);
    }

    console.log('Found subject:', subject);

    // Save current attendance using upsert
    await Promise.all(
      attendanceData.map(async (data) => {
        return prisma.attendance.upsert({
          where: {
            studentId_subjectId_date_time: {
              studentId: data.studentId,
              subjectId: parseInt(subjectId),
              date: new Date(date),
              time: time
            }
          },
          update: {
            isPresent: data.isPresent
          },
          create: {
            date: new Date(date),
            time: time,
            isPresent: data.isPresent,
            studentId: data.studentId,
            subjectId: parseInt(subjectId)
          }
        });
      })
    );

    // Get all students of specific class
    const students = await prisma.student.findMany({
      where: {
        AND: [
          {
            id: {
              in: attendanceData.map(d => d.studentId)
            }
          },
          {
            class: className
          }
        ]
      },
      orderBy: {
        rollNo: 'asc'
      }
    });

    console.log(`Found ${students.length} students for class ${className}`);

    // Get attendance records ONLY for this specific subject and class
    const allAttendance = await prisma.attendance.findMany({
      where: {
        AND: [
          {
            student: {
              class: className
            }
          },
          {
            subjectId: parseInt(subjectId) // Strict subject filtering
          }
        ]
      },
      include: {
        student: true
      },
      orderBy: [
        { date: 'asc' },
        { student: { rollNo: 'asc' } }
      ]
    });

    console.log(`Found ${allAttendance.length} attendance records for subject ${subject.name}`);

    // Create the current date key
    const currentDateKey = `${new Date(date).toISOString().split('T')[0]} (${time})`;

    // Get unique dates including the current date
    const uniqueDates = [...new Set([
      currentDateKey,
      ...allAttendance.map(record => 
        `${record.date.toISOString().split('T')[0]} (${record.time})`
      )
    ])].sort();

    console.log('Unique dates:', uniqueDates);

    // Create attendance lookup including current attendance
    const attendanceLookup = {};
    
    // Add current day's attendance
    attendanceData.forEach(data => {
      if (!attendanceLookup[data.studentId]) {
        attendanceLookup[data.studentId] = {};
      }
      attendanceLookup[data.studentId][currentDateKey] = data.isPresent ? 1 : 0;
    });

    // Add historical attendance
    allAttendance.forEach(record => {
      const dateKey = `${record.date.toISOString().split('T')[0]} (${record.time})`;
      if (!attendanceLookup[record.studentId]) {
        attendanceLookup[record.studentId] = {};
      }
      attendanceLookup[record.studentId][dateKey] = record.isPresent ? 1 : 0;
    });

    // Prepare Excel data
    const excelData = [
      // Header rows
      {
        'Roll No': '',
        'Student Name': `Class: ${className}`,
        ...Object.fromEntries(uniqueDates.map(date => [date, '']))
      },
      {
        'Roll No': '',
        'Student Name': `Subject: ${subject.name}`,
        ...Object.fromEntries(uniqueDates.map(date => [date, '']))
      },
      {
        'Roll No': '',
        'Student Name': '',
        ...Object.fromEntries(uniqueDates.map(date => [date, '']))
      },
      // Student data
      ...students.map(student => {
        const rowData = {
          'Roll No': student.rollNo,
          'Student Name': student.name,
        };

        uniqueDates.forEach(dateKey => {
          rowData[dateKey] = attendanceLookup[student.id]?.[dateKey] ?? 'N/A';
        });

        return rowData;
      })
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 10 },
      { wch: 20 },
      ...uniqueDates.map(() => ({ wch: 15 }))
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, `${className}_${subject.name}`);

    // Generate filename
    const filename = `attendance_${className}_${subject.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Send response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);

  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
};

exports.getStudentsByClass = async (req, res) => {
  try {
    const { className } = req.params;
    
    const students = await prisma.student.findMany({
      where: {
        class: className
      },
      orderBy: {
        rollNo: 'asc'
      }
    });

    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

exports.getAttendanceReport = async (req, res) => {
  try {
    const { className, date } = req.query;
    
    const attendance = await prisma.attendance.findMany({
      where: {
        date: new Date(date),
        student: {
          class: className
        }
      },
      include: {
        student: true,
        subject: true
      }
    });

    res.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance report:', error);
    res.status(500).json({ error: 'Failed to fetch attendance report' });
  }
};

// Add this new endpoint to check first lecture absences
exports.getFirstLectureAbsentees = async (req, res) => {
  try {
    const { date, className } = req.query;

    // Get the earliest lecture's attendance for the given date
    const firstLectureAttendance = await prisma.attendance.findMany({
      where: {
        date: new Date(date),
        student: {
          class: className
        }
      },
      include: {
        student: true
      },
      orderBy: {
        time: 'asc'
      }
    });

    // Get the earliest time for that date
    const earliestTime = firstLectureAttendance[0]?.time;
    
    if (!earliestTime) {
      return res.json({ absentees: [] });
    }

    // Get students who were absent in the first lecture
    const absentStudents = firstLectureAttendance
      .filter(record => record.time === earliestTime && !record.isPresent)
      .map(record => record.student.rollNo);

    res.json({ absentees: absentStudents });
  } catch (error) {
    console.error('Error getting first lecture absentees:', error);
    res.status(500).json({ error: 'Failed to get first lecture absentees' });
  }
}; 
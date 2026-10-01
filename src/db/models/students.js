module.exports = (sequelize, DT) => {
  const Student = sequelize.define(
    'Student',
    {
      schoolId: { type: DT.INTEGER, allowNull: false },
      grNumber: { type: DT.TEXT, allowNull: false },
      name: { type: DT.TEXT, allowNull: false },
      gender: DT.TEXT,
      dob: DT.DATEONLY,
      dobIsApproximate: { type: DT.BOOLEAN, defaultValue: false },
      estimatedBirthYear: DT.SMALLINT,
      bloodGroup: DT.TEXT,
      address: DT.TEXT,
      fatherName: DT.TEXT,
      motherName: DT.TEXT,
      guardianName: DT.TEXT,
      guardianRelation: DT.TEXT,
      guardianPhone: DT.TEXT,
      guardianPhone2: { type: DT.TEXT, field: 'guardian_phone_2' },
      guardianLanguage: DT.TEXT,
      aadhaarLast4: { type: DT.CHAR(4), field: 'aadhaar_last4' },
      photoKey: DT.TEXT,
      admissionDate: DT.DATEONLY,
      status: { type: DT.TEXT, defaultValue: 'active' },
      leftOn: DT.DATEONLY,
      leftReason: DT.TEXT,
      leftNote: DT.TEXT,
      consentPhoto: { type: DT.BOOLEAN, defaultValue: false },
    },
    { tableName: 'students' },
  );

  const Enrollment = sequelize.define(
    'Enrollment',
    {
      schoolId: { type: DT.INTEGER, allowNull: false },
      academicYearId: { type: DT.INTEGER, allowNull: false },
      studentId: { type: DT.INTEGER, allowNull: false },
      classSectionId: { type: DT.INTEGER, allowNull: false },
      rollNumber: DT.INTEGER,
      status: { type: DT.TEXT, defaultValue: 'active' },
      enrolledOn: DT.DATEONLY,
      exitedOn: DT.DATEONLY,
      previousEnrollmentId: DT.INTEGER,
    },
    { tableName: 'enrollments' },
  );

  return { Student, Enrollment };
};

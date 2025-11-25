const express = require('express');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const router = express.Router();

// Enroll in course
router.post('/enroll', async (req, res) => {
  try {
    const { courseId } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token and get user ID
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const studentId = decoded.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId
    });

    if (existingEnrollment) {
      return res.status(400).json({ message: 'Already enrolled in this course' });
    }

    const enrollment = await Enrollment.create({
      student: studentId,
      course: courseId
    });

    // Update enrollment count
    course.enrollmentCount += 1;
    await course.save();

    await enrollment.populate('course', 'title description duration instructor');
    await enrollment.populate('student', 'username profile');

    res.status(201).json({
      message: 'Enrollment successful',
      enrollment
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user enrollments
router.get('/my-courses', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const studentId = decoded.id;

    const enrollments = await Enrollment.find({ student: studentId })
      .populate({
        path: 'course',
        populate: { path: 'instructor', select: 'username profile' }
      })
      .sort({ createdAt: -1 });

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');

exports.enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId
    });

    if (existingEnrollment) {
      return res.status(400).json({ message: 'Already enrolled in this course' });
    }

    const enrollment = new Enrollment({
      student: req.user.id,
      course: courseId
    });

    await enrollment.save();

    // Update enrollment count
    course.enrollmentCount += 1;
    await course.save();

    await enrollment.populate('course', 'title description duration instructor');
    await enrollment.populate('student', 'username profile');

    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getMyEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user.id })
      .populate({
        path: 'course',
        populate: { path: 'instructor', select: 'username profile' }
      })
      .sort({ enrolledAt: -1 });

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateProgress = async (req, res) => {
  try {
    const { progress } = req.body;

    const enrollment = await Enrollment.findOne({
      _id: req.params.id,
      student: req.user.id
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    enrollment.progress = progress;
    if (progress === 100) {
      enrollment.completed = true;
      enrollment.completedAt = new Date();
    }

    await enrollment.save();
    res.json(enrollment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
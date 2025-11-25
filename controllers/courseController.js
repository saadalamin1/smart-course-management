const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');

exports.getAllCourses = async (req, res) => {
  try {
    const { category, level, search } = req.query;
    let filter = { isPublished: true };

    if (category) filter.category = category;
    if (level) filter.level = level;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const courses = await Course.find(filter)
      .populate('instructor', 'username profile')
      .sort({ createdAt: -1 });

    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructor', 'username profile');

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if user is enrolled
    let isEnrolled = false;
    if (req.user) {
      const enrollment = await Enrollment.findOne({
        student: req.user.id,
        course: req.params.id
      });
      isEnrolled = !!enrollment;
    }

    res.json({ ...course.toObject(), isEnrolled });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const course = new Course({
      ...req.body,
      instructor: req.user.id
    });

    await course.save();
    await course.populate('instructor', 'username profile');

    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    let course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if user is instructor or admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    ).populate('instructor', 'username profile');

    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
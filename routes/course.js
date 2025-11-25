const express = require('express');
const Course = require('../models/Course');
const User = require('../models/User');
const router = express.Router();

// Get all published courses
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find({ isPublished: true })
      .populate('instructor', 'username profile')
      .sort({ createdAt: -1 });
    
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single course
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructor', 'username profile');

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create sample courses (for testing)
router.post('/seed', async (req, res) => {
  try {
    // Find admin user or create one
    let admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      admin = await User.create({
        username: 'admin',
        email: 'admin@smartcourse.com',
        password: 'admin123',
        role: 'admin',
        profile: { firstName: 'System', lastName: 'Admin' }
      });
    }

    const sampleCourses = [
      {
        title: "JavaScript Basics",
        description: "Learn JS fundamentals and DOM manipulation.",
        instructor: admin._id,
        category: "Programming",
        duration: "6 weeks",
        level: "beginner",
        price: 0,
        isPublished: true,
        enrollmentCount: 15
      },
      {
        title: "HTML & CSS Design",
        description: "Create modern responsive websites.",
        instructor: admin._id,
        category: "Web Design",
        duration: "4 weeks",
        level: "beginner",
        price: 0,
        isPublished: true,
        enrollmentCount: 12
      },
      {
        title: "Node.js Backend Development",
        description: "Build scalable server-side applications.",
        instructor: admin._id,
        category: "Programming",
        duration: "8 weeks",
        level: "intermediate",
        price: 0,
        isPublished: true,
        enrollmentCount: 8
      }
    ];

    await Course.deleteMany({});
    const courses = await Course.insertMany(sampleCourses);
    
    // Populate instructor info
    await Course.populate(courses, { path: 'instructor', select: 'username profile' });

    res.json({ message: 'Sample courses created', courses });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
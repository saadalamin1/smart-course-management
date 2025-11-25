const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartcourse')
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB connection error:', err));

// Email Configuration
const createTransporter = () => {
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
        console.log('Email credentials not configured. Using test mode.');
        return {
            sendMail: (options) => {
                console.log('TEST MODE - Email would be sent to:', options.to);
                console.log('Subject:', options.subject);
                return Promise.resolve({ messageId: 'test-mode' });
            }
        };
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });
};

// Email Service
const sendEmail = async (to, subject, html) => {
    try {
        const transporter = createTransporter();
        const mailOptions = {
            from: process.env.SMTP_EMAIL || 'test@smartcourse.com',
            to: to,
            subject: subject,
            html: html,
        };

        const result = await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
        return { success: true, result };
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
};

// Email Templates - FIXED
const emailTemplates = {
    welcome: (user) => ({
        subject: 'Welcome to SmartCourse!',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0d6efd;">Welcome to SmartCourse!</h2>
            <p>Hello <strong>${user.username}</strong></p>
            <p>Thank you for joining SmartCourse! We're excited to have you as part of our learning community.</p>
            <p>With your account, you can:</p>
            <ul>
                <li>Browse and enroll in courses</li>
                <li>Track your learning progress</li>
                <li>Access course materials</li>
                <li>Connect with instructors</li>
            </ul>
            <p>Start your learning journey by exploring our course catalog!</p>
            <div style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                <p style="margin: 0; color: #6b7280;">
                    Username: ${user.username}<br>
                    Email: ${user.email}
                </p>
            </div>
            <p style="margin-top: 2rem;">Happy Learning!<br>The SmartCourse Team</p>
        </div>
        `
    }),
    enrollment: (user, course) => ({
        subject: `🎓 Enrollment Confirmation - ${course?.title || 'Your Course'}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">You're Enrolled!</h2>
            <p>Hello <strong>${user?.username || 'Student'}</strong></p>
            <p>You have successfully enrolled in the course:</p>
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px; margin: 1rem 0;">
                <h3 style="margin: 0 0 0.5rem 0; color: #0d6efd;">${course?.title || 'Your Course'}</h3>
                <p style="margin: 0.5rem 0;"><strong>Duration:</strong> ${course?.duration || 'Self-paced'}</p>
                <p style="margin: 0.5rem 0;"><strong>Level:</strong> ${course?.level || 'All levels'}</p>
                <p style="margin: 0.5rem 0;"><strong>Instructor:</strong> ${course?.instructor?.username || 'Admin'}</p>
            </div>
            <p>You can now start learning by accessing the course materials in your dashboard.</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
               style="display: inline-block; padding: 12px 24px; background: #0d6efd; color: white; text-decoration: none; border-radius: 6px; margin: 1rem 0;">
                Go to Dashboard
            </a>
            <p style="margin-top: 2rem; color: #6b7280;">
                If you have any questions about the course, please contact your instructor.
            </p>
        </div>
        `
    }),
    progressUpdate: (user, course, progress) => {
        const progressMessage = progress === 100 
            ? '🎉 Congratulations on completing the course! Well done!' 
            : 'Keep up the great work! You are making excellent progress.';
        
        const courseTitle = course?.title || 'Your Course';
        
        return {
            subject: `📈 Progress Update - ${courseTitle}`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ffc107;">Learning Progress Update</h2>
                <p>Hello <strong>${user?.username || 'Student'}</strong></p>
                <p>Great news! Your progress in <strong>${courseTitle}</strong> has been updated:</p>
                <div style="background: #fff3cd; padding: 1.5rem; border-radius: 8px; margin: 1rem 0;">
                    <h3 style="margin: 0 0 1rem 0; color: #856404;">Progress: ${progress}%</h3>
                    <div style="background: #e9ecef; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: #ffc107; height: 100%; width: ${progress}%;"></div>
                    </div>
                </div>
                <p>${progressMessage}</p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
                   style="display: inline-block; padding: 12px 24px; background: #0d6efd; color: white; text-decoration: none; border-radius: 6px; margin: 1rem 0;">
                    Continue Learning
                </a>
            </div>
            `
        };
    }
};

// Enhanced Email Service with Templates - FIXED
const sendTemplateEmail = async (to, templateName, data) => {
    try {
        const template = emailTemplates[templateName];
        if (!template) {
            throw new Error(`Template '${templateName}' not found`);
        }
        
        // Validate required data
        if (templateName === 'enrollment' && (!data.course || !data.course.title)) {
            console.warn('Missing course title for enrollment email, using fallback');
        }
        
        if (templateName === 'progressUpdate' && (!data.course || !data.course.title)) {
            console.warn('Missing course title for progress email, using fallback');
        }
        
        const emailContent = template(data.user || data.student, data.course, data.progress);
        return await sendEmail(to, emailContent.subject, emailContent.html);
    } catch (error) {
        console.error('Failed to send template email:', error);
        return { success: false, error: error.message };
    }
};

// Schemas
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'student' },
    profile: {
        firstName: String,
        lastName: String
    }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    return user;
};

const User = mongoose.model('User', userSchema);

const courseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    duration: { type: String, required: true },
    level: { type: String, default: 'beginner' },
    price: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    enrollmentCount: { type: Number, default: 0 }
}, { timestamps: true });

const Course = mongoose.model('Course', courseSchema);

const enrollmentSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date }
}, { timestamps: true });

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ==== AUTH ROUTES ====

// Register user with welcome email
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create user
        const user = await User.create({
            username,
            email,
            password,
            profile: { firstName, lastName }
        });

        const token = generateToken(user._id);

        // Send welcome email (async - don't wait for it)
        sendTemplateEmail(user.email, 'welcome', { user })
            .catch(error => console.error('Welcome email failed:', error));

        res.status(201).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                profile: user.profile
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user._id);

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                profile: user.profile
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get current user
app.get('/api/auth/me', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
});

// ==== COURSE ROUTES ====

// Get all courses
app.get('/api/courses', async (req, res) => {
    try {
        const { search, category, level } = req.query;
        let filter = { isPublished: true };

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        if (category) filter.category = category;
        if (level) filter.level = level;

        const courses = await Course.find(filter)
            .populate('instructor', 'username profile')
            .sort({ createdAt: -1 });

        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get single course
app.get('/api/courses/:id', async (req, res) => {
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

// Create sample courses
app.post('/api/courses/seed', async (req, res) => {
    try {
        // Find or create admin user
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
                title: "JavaScript Fundamentals",
                description: "Master the basics of JavaScript programming language. Learn variables, functions, loops, and DOM manipulation.",
                instructor: admin._id,
                category: "Programming",
                duration: "6 weeks",
                level: "beginner",
                price: 0,
                isPublished: true,
                enrollmentCount: 25
            },
            {
                title: "HTML & CSS Mastery",
                description: "Learn to create beautiful, responsive websites using HTML5 and CSS3. Modern layout techniques and best practices.",
                instructor: admin._id,
                category: "Web Design",
                duration: "4 weeks",
                level: "beginner",
                price: 0,
                isPublished: true,
                enrollmentCount: 18
            },
            {
                title: "Node.js Backend Development",
                description: "Build scalable server-side applications with Node.js, Express, and MongoDB. RESTful APIs and authentication.",
                instructor: admin._id,
                category: "Programming",
                duration: "8 weeks",
                level: "intermediate",
                price: 0,
                isPublished: true,
                enrollmentCount: 12
            },
            {
                title: "React Frontend Framework",
                description: "Modern React development with hooks, context API, and state management. Build real-world applications.",
                instructor: admin._id,
                category: "Programming",
                duration: "7 weeks",
                level: "intermediate",
                price: 0,
                isPublished: true,
                enrollmentCount: 15
            },
            {
                title: "Python for Data Science",
                description: "Data analysis and visualization with Python. Learn Pandas, NumPy, Matplotlib for data manipulation.",
                instructor: admin._id,
                category: "Data Science",
                duration: "8 weeks",
                level: "intermediate",
                price: 0,
                isPublished: true,
                enrollmentCount: 8
            }
        ];

        await Course.deleteMany({});
        const courses = await Course.insertMany(sampleCourses);

        res.json({
            message: 'Sample courses created successfully!',
            courses: courses.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==== ENROLLMENT ROUTES ====

// Enroll in course with confirmation email - FIXED
app.post('/api/enrollments/enroll', async (req, res) => {
    try {
        const { courseId } = req.body;
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const studentId = decoded.id;

        const course = await Course.findById(courseId).populate('instructor', 'username');
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
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

        // Send enrollment confirmation email (async) - FIXED
        sendTemplateEmail(student.email, 'enrollment', { 
            user: student, 
            course: course 
        }).catch(error => console.error('Enrollment email failed:', error));

        res.status(201).json({
            message: 'Enrollment successful!',
            enrollment
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get user enrollments
app.get('/api/enrollments/my-courses', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

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

// Update enrollment progress with notification email - FIXED
app.put('/api/enrollments/:enrollmentId/progress', async (req, res) => {
    try {
        const { progress } = req.body;
        const { enrollmentId } = req.params;
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const studentId = decoded.id;

        const enrollment = await Enrollment.findOne({
            _id: enrollmentId,
            student: studentId
        }).populate({
            path: 'course',
            select: 'title instructor'
        }).populate({
            path: 'student', 
            select: 'username email profile'
        });

        if (!enrollment) {
            return res.status(404).json({ message: 'Enrollment not found' });
        }

        const oldProgress = enrollment.progress;
        enrollment.progress = progress;

        if (progress === 100) {
            enrollment.completed = true;
            enrollment.completedAt = new Date();
        }

        await enrollment.save();

        // Send progress update email if progress increased significantly - FIXED
        if (progress > oldProgress && (progress === 100 || progress % 25 === 0)) {
            console.log('Progress email data:', {
                student: enrollment.student?.username,
                course: enrollment.course?.title,
                progress
            });

            // Only send email if course data exists
            if (enrollment.course) {
                sendTemplateEmail(enrollment.student.email, 'progressUpdate', {
                    user: enrollment.student,
                    course: enrollment.course,
                    progress
                }).catch(error => console.error('Progress email failed:', error));
            } else {
                console.warn('Skipping progress email - missing course data');
            }
        }

        res.json(enrollment);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==== EMAIL TEST ROUTES ====
app.post('/api/email/test', async (req, res) => {
    try {
        const { email } = req.body;
        const testHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0d6efd;">SmartCourse Email Test - WORKING!</h2>
            <p>Congratulations! Your email system is now working correctly.</p>
            <p><strong>Timestamp:</strong> ${new Date().toString()}</p>
            <p><strong>From:</strong> ${process.env.SMTP_EMAIL}</p>
            <p><strong>To:</strong> ${email}</p>
            <hr>
            <p style="color: #6b7280;">The email system has been configured successfully.</p>
        </div>`;

        const result = await sendEmail(email, 'SmartCourse Test Email', testHtml);

        if (result.success) {
            res.json({
                success: true,
                message: 'Test email sent successfully! Check your inbox and spam folder.',
                details: result.result
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send email',
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

// Email status check
app.get('/api/email/status', (req, res) => {
    res.json({
        nodemailer: 'loaded',
        version: require('nodemailer/package.json').version,
        smtp_configured: !!(process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD),
        smtp_email: process.env.SMTP_EMAIL || 'not configured',
        service: 'Gmail'
    });
});

// ==== GENERAL ROUTES ====
app.get('/', (req, res) => {
    res.json({
        message: 'Smart Course Management System API with Email - FIXED',
        status: 'Running',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        email: process.env.SMTP_EMAIL ? 'Configured' : 'Test Mode',
        version: '2.0.0',
        endpoints: [
            'GET /api/courses',
            'POST /api/auth/register',
            'POST /api/auth/login',
            'GET /api/auth/me',
            'POST /api/enrollments/enroll',
            'GET /api/enrollments/my-courses',
            'PUT /api/enrollments/:id/progress',
            'POST /api/courses/seed',
            'POST /api/email/test',
            'GET /api/email/status'
        ]
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        email: process.env.SMTP_EMAIL ? 'Configured' : 'Test Mode',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()) + ' seconds'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        message: 'Route not found',
        availableEndpoints: [
            '/api/courses',
            '/api/auth/register',
            '/api/auth/login',
            '/api/enrollments/enroll',
            '/api/email/test'
        ]
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}/`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log(`Email: ${process.env.SMTP_EMAIL ? 'Configured' : 'Test Mode'}`);
    console.log(`Test email: POST http://localhost:${PORT}/api/email/test`);
});
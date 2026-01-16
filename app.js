//###################################################
//# app.js created by Mohamed shabaan (Moshft)      #
//# Contact Me on: moshft.hup.icu                   #
//# Email: moshft@outlook.com                       #
//# Facebook: https://www.facebook.com/moshft       #
//# Twitter: https://twitter.com/moshft             #
//# GitHub: https://github.com/mo-shft/Zchat/       #
//####################################################
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { getLinkPreview } = require('link-preview-js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);

// 1. إعدادات الأمان (CSP) لحل مشكلة البلوك في المتصفح
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "connect-src * 'unsafe-inline'; " +
        "img-src * data: blob:; " +
        "frame-src *; " +
        "style-src * 'unsafe-inline'; " +
        "media-src * data: blob:;"
    );
    next();
});

// خدمة ملفات الفرونت إند (تأكد أن ملف index.html في نفس المجلد)
app.use(express.static(__dirname));

const io = new Server(server, {
    cors: {
        origin: "*", // السماح بالاتصال من أي مصدر لتجنب مشاكل CORS
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e8 // زيادة حجم الملفات المسموح بها إلى 100 ميجابايت
});

io.on('connection', (socket) => {
    console.log('مستخدم جديد اتصل:', socket.id);

    // عند انضمام مستخدم وتحديد اسمه
    socket.on('join', (userName) => {
        socket.userName = userName || "مستخدم مجهول";
        socket.emit('yourID', socket.id);
        console.log(`المستخدم ${socket.userName} سجل دخوله بـ ID: ${socket.id}`);
    });

    // استقبال وإرسال الرسائل والبيانات
    socket.on('sendMessage', async (data) => {
        const messageId = uuidv4(); // إنشاء ID فريد للرسالة لتتبع حالة القراءة
        let preview = null;

        // فحص الروابط للمعاينة التلقائية
        if (data.type === 'text' && data.content.includes('http')) {
            const urls = data.content.match(/\bhttps?:\/\/\S+/gi);
            if (urls && urls.length > 0) {
                try {
                    preview = await getLinkPreview(urls[0]);
                } catch (e) {
                    console.log("فشل جلب معاينة الرابط");
                }
            }
        }

        const messagePayload = {
            messageId,
            senderId: socket.id,
            user: socket.userName,
            content: data.content,
            type: data.type, // text, image, video, document
            fileName: data.fileName || null,
            linkPreview: preview,
            read: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // إرسال الرسالة للجميع بما فيهم المرسل
        io.emit('chatMessage', messagePayload);
    });

    // ميزة تأكيد القراءة
    socket.on('markAsRead', (msgId) => {
        // إبلاغ الآخرين أن الرسالة تمت قراءتها
        socket.broadcast.emit('messageReadByOther', msgId);
    });

    // ميزة جاري الكتابة
    socket.on('typing', () => {
        socket.broadcast.emit('userTyping', { user: socket.userName });
    });

    socket.on('stopTyping', () => {
        socket.broadcast.emit('userStopTyping');
    });

    socket.on('disconnect', () => {
        console.log('مستخدم غادر:', socket.id);
    });
});

// تشغيل السيرفر على المنفذ 3001
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`-----------------------------------------`);
    console.log(`🚀 السيرفر يعمل بنجاح على: http://localhost:${PORT}`);
    console.log(`-----------------------------------------`);
});
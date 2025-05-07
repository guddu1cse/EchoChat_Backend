import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

let users = {};
const messages = {};

io.on('connection', (socket) => {
    socket.on('set_username', (username) => {
        users[socket.id] = { username };
        io.emit('users_list', getAllUsers());
    });

    socket.on('private_message', ({ to, message, senderName }) => {
        const key = [socket.id, to].sort().join(':');
        messages[key] = [...(messages[key] || []), { from: socket.id, message, senderName }];

        io.to(to).emit('private_message', {
            from: socket.id,
            senderName,
            message,
        });
    });

    socket.on('retrieve_chat_history', (toUserId) => {
        const key = [socket.id, toUserId].sort().join(':');
        io.to(socket.id).emit('chat_history', messages[key] || []);
    });

    socket.on('typing', ({ to, isTyping }) => {
        io.to(to).emit('typing', { userId: socket.id, isTyping });
    });

    socket.on('incoming_call', ({ offer, to }) => {
        console.log('incoming_call');
        io.to(to).emit('receive_offer', {
            from: socket.id,
            offer,
        });
    });

    socket.on('incoming_answer', ({ answer, to }) => {
        console.log('incoming_answer');
        io.to(to).emit('receive_answer', {
            from: socket.id,
            answer,
        });
    });

    socket.on('ice_candidate', ({ candidate, to }) => {
        console.log('ice_candidate');
        io.to(to).emit('ice_candidate', {
            from: socket.id,
            candidate,
        });
    });

    socket.on('call_ended', ({ to }) => {
        console.log('call_ended');
        io.to(to).emit('call_ended', { from: socket.id });
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('users_list', getAllUsers());
    });
});

function getAllUsers() {
    return Object.entries(users).map(([id, user]) => ({
        id,
        username: user.username,
    }));
}

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
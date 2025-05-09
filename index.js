import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(cors());
app.use(express.json());

let users = {};
const messages = {};
const activeCalls = new Map(); // Track active calls

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

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
        console.log('Incoming call from:', socket.id, 'to:', to);

        // Check if the target user is already in a call
        if (activeCalls.has(to)) {
            io.to(socket.id).emit('call_rejected', {
                from: to,
                reason: 'User is busy'
            });
            return;
        }

        // Track the active call
        activeCalls.set(to, socket.id);
        activeCalls.set(socket.id, to);

        io.to(to).emit('receive_offer', {
            from: socket.id,
            offer,
        });
    });

    socket.on('incoming_answer', ({ answer, to }) => {
        console.log('Answer received from:', socket.id, 'to:', to);
        io.to(to).emit('receive_answer', {
            from: socket.id,
            answer,
        });
    });

    socket.on('ice_candidate', ({ candidate, to }) => {
        console.log('ICE candidate from:', socket.id, 'to:', to);
        io.to(to).emit('ice_candidate', {
            from: socket.id,
            candidate,
        });
    });

    socket.on('call_ended', ({ to }) => {
        console.log('Call ended by:', socket.id, 'with:', to);

        // Remove the call from active calls
        activeCalls.delete(to);
        activeCalls.delete(socket.id);

        io.to(to).emit('call_ended', {
            from: socket.id,
            reason: 'Call ended by peer'
        });
    });

    socket.on('call_rejected', ({ to }) => {
        console.log('Call rejected by:', socket.id, 'from:', to);

        // Remove the call from active calls
        activeCalls.delete(to);
        activeCalls.delete(socket.id);

        io.to(to).emit('call_rejected', {
            from: socket.id,
            reason: 'Call rejected by peer'
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);

        // Clean up any active calls
        const activeCall = activeCalls.get(socket.id);
        if (activeCall) {
            io.to(activeCall).emit('call_ended', {
                from: socket.id,
                reason: 'Peer disconnected'
            });
            activeCalls.delete(activeCall);
            activeCalls.delete(socket.id);
        }

        delete users[socket.id];
        io.emit('users_list', getAllUsers());
    });

    socket.on('media_controller', ({ to, micEnabled, cameraEnabled }) => {
        console.log('Media control update from:', socket.id, 'to:', to);
        io.to(to).emit('media_controller', {
            from: socket.id,
            micEnabled,
            cameraEnabled
        });
    });

    // Handle connection errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

function getAllUsers() {
    return Object.entries(users).map(([id, user]) => ({
        id,
        username: user.username,
        inCall: activeCalls.has(id)
    }));
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
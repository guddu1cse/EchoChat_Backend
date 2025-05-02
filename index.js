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

let users = {}; // storing all user details in memory
const messages = {};// store the message history for current session

io.on('connection', (socket) => {
    //console.log(`Connected: ${socket.id}`);

    socket.on('set_username', (username) => {
        users[socket.id] = { username };
        io.emit('users_list', getAllUsers());
        //console.log('Updated users:', getAllUsers());
    });

    socket.on('private_message', ({ to, message, senderName }) => {
        const key = [socket.id, to].sort().join(':');
        messages[key] = [...(messages[key] || []), { from: socket.id, message, senderName }]; // creating message history for every user


        io.to(to).emit('private_message', {
            from: socket.id,
            senderName,
            message,
        });
    });

    socket.on('retrieve_chat_history', (toUserId) => {
        const key = [socket.id, toUserId].sort().join(':');
        //console.log("retrieve_chat_history", 'to userId', toUserId, messages[key] || []);
        io.to(socket.id).emit('chat_history', messages[key] || []);
    }); // retrieve chat history

    socket.on('disconnect', () => {
        //console.log(`Disconnected: ${socket.id}`);
        delete users[socket.id];
        io.emit('users_list', getAllUsers());
    });

    socket.on('typing', ({ to, isTyping }) => {
        io.to(to).emit('typing', { userId: socket.id, isTyping });
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
    //console.log(`ws running on port ${PORT}`);
});

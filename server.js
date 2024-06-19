const http = require("http")
const express = require("express");
const path = require("path");
const app = express();
app.use(express.urlencoded({ extended: true })); // To parse form data
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const cookieParser = require("cookie-parser");
app.use(cookieParser());
const session = require('express-session');


const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, {
    debug: true
});
let participants = {};

const { v4: uuidV4 } = require('uuid')

app.use('/peerjs', peerServer);

app.set('view engine', 'ejs')

app.use(express.static(path.resolve('./public')))


// Initialize express session
const sessionMiddleware = session({
    secret: 'userEmail',
    resave: false,
    saveUninitialized: true
    
});

app.use(sessionMiddleware);

io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});


io.on("connection", (socket) => {
    socket.on('join-room', (roomId, userName, userId, userEmail) => {       

        if (!participants[userEmail]) {
            participants[userEmail] = { userId: userId, socketId: socket.id, name: userName, userEmail: userEmail, isHost: false };
        } else {
            // Update the socketId if the user already exists
            participants[userEmail].socketId = socket.id;
        }
      
        // Generate session
        socket.request.session.userName = userName;
        socket.request.session.userId = userId;
        socket.request.session.save();
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', { userId, userName, userEmail });
       
        console.log("joined user is: " + userName +"Id: "+userId);
        // console.log(["Join the room"], io.sockets.adapter.rooms.get(roomId));


        socket.on('reconnect-user', (roomId, userName, userId) => {
            // Handle reconnection logic
            socket.request.session.userName = userName;
            socket.request.session.userId = userId;
            socket.request.session.save();
            console.log("user reconnected to the room :" + socket.request.session.userId);
            socket.join(roomId);
            console.log("reconnected user is: " + userName);
            socket.to(roomId).emit('user-reconnected', userId);
        });

        socket.on('message', (message) => {
            const userName = socket.request.session.userName;
            console.log(socket.request.session.userName);
            console.log('Message received:', message);
            io.to(roomId).emit('createMessage', { message, userName });
        });

        // Handle camera toggle event
        socket.on('camera-toggled', ({ USER_NAME, videoEnabled, userId,USER_EMAIL }) => {         
            console.log(`Camera toggled: ${USER_NAME}, videoEnabled: ${videoEnabled},userId: ${userId},userEmail: ${USER_EMAIL}`);
            io.to(roomId).emit('user-camera-toggled', { USER_NAME, videoEnabled, userId,USER_EMAIL });
        });

        // When a user disconnects
        socket.on('disconnect', () => {
            delete participants[socket.id];
            // Notify all clients in the room about the updated participant list
            io.emit('update-participant-list', participants);
        });

        // Handle mute participant request
        socket.on('mute-participant', (userId) => {
            const participant = participants[userId];
            if (participant) {
                io.to(participant.socketId).emit('mute'); // Send mute event to the specific participant
            }
        });

        // Handle remove participant request
        socket.on('remove-participant', (userId) => {
            const participant = participants[userId];
            if (participant) {
                io.to(participant.socketId).emit('remove'); // Send remove event to the specific participant
                delete participants[userId]; // Remove from participants list
                io.emit('update-participant-list', participants); // Update the participant list
            }
        });

        socket.on('participents-List', () => {  
            cleanupParticipantsList(roomId);         
            io.to(roomId).emit('update-participant-list', participants);
        });

        socket.on('muteUnmute-participant', (userId) => {
            const participant = participants[userId];
            if (participant) {
                console.log(participant.socketId);
                io.to(participant.socketId).emit('muteUnmute'); // Send mute event to the specific participant
            }
        });
    });
});

// Cleanup function to remove disconnected users from the participants list
function cleanupParticipantsList(roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    const connectedSocketIds = room ? Array.from(room) : [];

    for (const email in participants) {
        if (!connectedSocketIds.includes(participants[email].socketId)) {
            delete participants[email];
        }
    }
}

// Render the user details form
app.get('/', (req, res) => {
    res.render('userDetails', { roomId: null });
});

// Render the user details form for new users
app.get('/get-user-details', (req, res) => {
    res.render('userDetails', { roomId: req.session.requestedRoom });
});

// Handle form submission and redirect to the room
app.post('/create-room', (req, res) => {
    console.log("create room")
    const userEmail = req.body.userEmail;
    const name = req.body.name;
    const roomId = req.body.roomId || uuidV4();
    // Store username in session   
    req.session.userEmail = userEmail;
    req.session.name = name;
    res.redirect(`/${roomId}`);
});

// Existing code for setting up the room route
app.get('/:room', (req, res) => {
    if (!req.session.userEmail) {       
        req.session.requestedRoom = req.params.room;
        res.redirect('/get-user-details');
    } else {
        res.render('room', { roomId: req.params.room, userEmail: req.session.userEmail, name: req.session.name });
    }
});

server.listen(3030, () => {
    console.log(`server start at port 3030`)
});


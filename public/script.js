const socket = io();
const videoGrid = document.getElementById('video-grid')

const myVideo = document.createElement('video')


myVideo.muted = true;
const peers = {}
let username;
let isRelodePage = true;
let previousSelectedIndex = -1; // Initialize with -1 to indicate no previous selection
let userId;
let totalParticipants = 0;
let myVideoStream;
let userVideoElement_SourceObject;
let participants = {};
let totalUser = 0;
let participant = 0;
const newList = {};
let mic;
let cameraDeviceId;


const peer = new Peer(undefined, {
    path: '/peerjs',
    host: '/',
    port: '3030'
})



const getDefaultCameraDeviceId = async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log('Available devices:', devices);

        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        if (videoDevices.length > 0) {
            // Return the deviceId of the first video input device
            return videoDevices[0].deviceId;
        } else {
            throw new Error('No video input devices found');
        }
    } catch (err) {
        console.error('Error enumerating devices:', err);
        throw err;
    }
};


const stremVideo = async (cameraDeviceId, audioDeviceId) => {
    // const constraints = { video: true, audio: { deviceId, exact: false } };  
    const constraints = {
        video: { deviceId: { exact: cameraDeviceId } },
        audio: { deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    myVideoStream = stream;
    addVideoStream(myVideo, stream, USER_NAME, USER_EMAIL);

    peer.on('call', call => {
        call.answer(stream)
        const video = document.createElement('video')
        call.on('stream', userVideoStream => {
            addVideoStream(video, userVideoStream, USER_NAME, USER_EMAIL)
        })
    });

    socket.on('user-connected', async (data) => {
        isRelodePage = false;
        // username = data.userName;
        // const stream = await getUserMedia();
        //  connectToNewUser(data.userId, stream, data.userName, data.userEmail);

        try {
            const stream = await getUserMedia();
            const call = peer.call(data.userId, stream);
            const video = document.createElement('video');

            call.on('stream', userVideoStream => {
                console.log('Stream received:', userVideoStream);
                addVideoStream(video, userVideoStream, data.userName, data.userEmail);
            });

            call.on('close', () => {
                console.log('Call closed');
                video.remove();
            });

            call.on('error', err => {
                console.error('Call error:', err);
            });

        } catch (err) {
            console.error('Error during call setup:', err);
        }

    });

    socket.on("createMessage", (data) => {
        console.log('Message received on client:', data.message); // Add this line
        $(".messages").append(`<li class="message"><b>${data.userName}</b><br/>${data.message}</li>`);
        scrollToBottom()
    });

    // camera Toggled
    socket.on('user-camera-toggled', ({ USER_NAME, videoEnabled, userId, USER_EMAIL }) => {

        const userVideoElement = Array.from(videoGrid.children).find(child =>
            child.tagName === 'VIDEO' && child.srcObject && child.srcObject.id === userId
        );
        // if (userVideoElement.style.display == "block" || !videoEnabled) {
        if (!videoEnabled) {
            userVideoElement.style.display = "none"
            let nameDisplay = Array.from(videoGrid.children).find(child =>
                child.classList.contains(userId)
            );
            if (!nameDisplay) {

                const nameGrid = document.createElement("div");
                // nameGrid.setAttribute("id", "nameGrid");
                nameGrid.classList.add('nameGrid');
                nameGrid.classList.add(userId);

                nameGrid.style.fontWeight = "bold"; // Apply styles directly to the element
                nameGrid.style.padding = "3px"
                nameGrid.style.backgroundColor = "white"
                nameGrid.style.border = "3px solid black"
                nameGrid.style.borderRadius = "10px"

                nameDisplay = document.createElement('span');
                nameDisplay.classList.add('user-name');
                nameDisplay.innerText = USER_NAME;
                nameDisplay.setAttribute('data-username', USER_NAME);

                firstLetter = document.createElement("h1");
                firstLetter.classList.add('first_leter');
                firstLetter.innerText = USER_NAME[0].toUpperCase();
                firstLetter.setAttribute('firstLeter-username', USER_NAME[0].toUpperCase());

                nameGrid.append(firstLetter)
                nameGrid.append(nameDisplay);

                videoGrid.append(nameGrid);
            }

        } else {
            const nameDisplay = Array.from(videoGrid.children).find(child =>
                child.classList.contains(userId)
            );

            if (nameDisplay) {
                videoGrid.removeChild(nameDisplay);
            }
            userVideoElement.style.display = "block";
            if (myVideoStream.id === userId)
                myVideoStream.getVideoTracks()[0].enabled = true;
        }

    });

    socket.on('update-participant-list', (updatedParticipants) => {
        Object.assign(participants, updatedParticipants);
        updateParticipantList();
    });

    socket.on('muteUnmute', () => {
        if (myVideoStream) {
            const enabled = myVideoStream.getAudioTracks()[0].enabled;
            if (enabled) {
                myVideoStream.getAudioTracks()[0].enabled = false;
                setUnmuteButton();
            } else {
                setMuteButton();
                myVideoStream.getAudioTracks()[0].enabled = true;
            }
        }
    });

};

async function getMediaStream(constraints) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return stream;
    } catch (err) {
        console.error('Error accessing media devices.', err);
        throw err;
    }
}

async function getUserMedia() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
  
    if (videoDevices.length > 0) {
        // Choose the first video device (you can modify this to choose a specific device)
        const constraints = {
            video: { deviceId: videoDevices[0].deviceId ? { exact: videoDevices[0].deviceId } : undefined }
        };

        return getMediaStream(constraints);
    } else {
        throw new Error('No video devices found');
    }
}



const addVideoStream = (video, stream, userName, userEmail) => {
    console.log('stream')
    Array.from(videoGrid.children).forEach(child => {
        if (child.tagName === 'VIDEO' && child.srcObject === stream) {
            videoGrid.removeChild(child);
        }
        if (child.classList.contains('user-name') && child.getAttribute('data-username') === userName) {
            videoGrid.removeChild(child);
        }
    });

    if (stream.getVideoTracks().length !== 0 && stream.getVideoTracks()[0].enabled) {
        video.srcObject = stream;
        video.addEventListener('loadedmetadata', () => {
            video.play();
        });

        totalUser = totalUser + 1;
        video.id = `video-user${totalUser}`;
        videoGrid.append(video);
    }

    const videos = Array.from(videoGrid.children);
    for (let i = 0; videos.length > i; i++) {
        if (videos[i].srcObject != undefined && !videos[i].srcObject.active) {
            videos[i].remove();
        }
    }
    userId = videoGrid.children[0].srcObject.id;
    totalParticipants = videoGrid.children.length
    let participent = document.getElementById("participants");
    participent.innerText = totalParticipants;

}

// input value
let text = $("input");
// when press enter send message
$('html').keydown(function (e) {
    if (e.which == 13 && text.val().length !== 0) {
        socket.emit('message', text.val());
        text.val('')
    }
});

peer.on('open', (id) => {
    socket.emit('join-room', ROOM_ID, USER_NAME, id, USER_EMAIL);
});

const scrollToBottom = () => {
    var d = $('.main__chat_window');
    d.scrollTop(d.prop("scrollHeight"));
}

// function connectToNewUser(userId, stream, userName, userEmail) {
//     console.log('working of new connect')
//     const call = peer.call(userId, stream)
//     const video = document.createElement('video')
//     call.on('stream', userVideoStream => {
//         addVideoStream(video, userVideoStream, userName, userEmail);
//     })
// }

//mic turn mute/Unmute
const muteUnmute = () => {
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getAudioTracks()[0].enabled = false;
        setUnmuteButton();
    } else {
        setMuteButton();
        myVideoStream.getAudioTracks()[0].enabled = true;
    }
}

// Mute a participant
function muteUnmuteParticipant(socketId, action, i) {
    socket.emit(`${action}-participant`, socketId);
    if (mic == undefined || mic == 'unmute') {
        mic = 'mute'
        setParticipantMuteUnmuteButton(i, mic);
    } else {
        mic = 'unmute'
        setParticipantMuteUnmuteButton(i, mic);
    }

}


//Camera turn on/off
const playStop = () => {
    let enabled = myVideoStream.getVideoTracks()[0].enabled;

    if (enabled) {
        myVideoStream.getVideoTracks()[0].enabled = false;
        setPlayVideo();
        socket.emit('camera-toggled', { USER_NAME, videoEnabled: false, userId, USER_EMAIL });
    } else {
        myVideoStream.getVideoTracks()[0].enabled = true;
        setStopVideo();
        socket.emit('camera-toggled', { USER_NAME, videoEnabled: true, userId, USER_EMAIL });
    }
};

document.getElementById('audioSetup').addEventListener('click', function () {
    var dropdown = document.getElementById('dropdownContainer');
    var cameraDropdown = document.getElementById('cameraDropdownContainer');
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        cameraDropdown.style.display = 'none';
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }

    event.stopPropagation(); // Stop the event from bubbling up
});

document.getElementById('cameraSetup').addEventListener('click', function () {
    var cameraDropdown = document.getElementById('cameraDropdownContainer');
    if (cameraDropdown.style.display === 'none' || cameraDropdown.style.display === '') {
        dropdown.style.display = 'none';
        cameraDropdown.style.display = 'block';
    } else {
        cameraDropdown.style.display = 'none';
    }
    event.stopPropagation(); // Stop the event from bubbling up
});


var dropdown = document.getElementById('dropdownContainer');
var audioSelect = document.querySelector('select[name="audio"]');

audioSelect.addEventListener('change', (event) => {
    const selectedIndex = event.target.selectedIndex;
    //selected audio input device
    var selectedOption = audioSelect.options[audioSelect.selectedIndex];
    var selectedDeviceId = selectedOption.value
    changeAudioDevice(selectedDeviceId);
    if (selectedIndex === previousSelectedIndex) {
        hideDropdown();
    }
    // Update the previous selected index
    previousSelectedIndex = selectedIndex;
    hideDropdown();
});

var cameraDropdown = document.getElementById('cameraDropdownContainer');
var cameraSelect = document.querySelector('select[name="camera"]');

cameraDropdown.addEventListener('change', (event) => {
    const selectedIndex = event.target.selectedIndex;
    var selectedOption = cameraSelect.options[cameraSelect.selectedIndex];
    var selectedDeviceId = selectedOption.value
    const currentAudioDeviceId = getCurrentAudioDeviceId();
    changeCameraDevice(selectedDeviceId);
    if (selectedIndex === previousSelectedIndex) {
        hideDropdown();
    }
    // Update the previous selected index
    previousSelectedIndex = selectedIndex;
    hideDropdown();
});



document.addEventListener('click', function (event) {
    const dropdownContainer = document.getElementById('dropdownContainer');
    const cameraDropdown = document.getElementById('cameraDropdownContainer');
    const target = event.target;
    if (!dropdownContainer.contains(target)) {
        hideDropdown();
    }
    if (!cameraDropdown.contains(target)) {
        hideDropdown();
    }
});

function hideDropdown() {
    var dropdown = document.getElementById('dropdownContainer');
    var cameraDropdown = document.getElementById('cameraDropdownContainer');
    dropdown.style.display = 'none';
    cameraDropdown.style.display = 'none';
}

const changeAudioDevice = async (deviceId) => {
    const constraints = {
        video: { deviceId: userId ? userId : undefined },
        audio: { deviceId: { exact: deviceId } }
    };
    let newStream = await navigator.mediaDevices.getUserMedia(constraints);
    myVideoStream.getAudioTracks().forEach(track => track.stop());
    myVideoStream = newStream;
    const audioTrack = myVideoStream.getAudioTracks()[0];
    Object.values(peer.connections).forEach(connection => {
        connection.forEach(conn => {
            conn.peerConnection.getSenders().forEach(sender => {
                if (sender.track.kind === 'audio') {
                    sender.replaceTrack(audioTrack);
                }
            });
        });
    });
};

const changeCameraDevice = async (deviceId) => {
    const constraints = { video: { deviceId: { exact: deviceId } }, audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    myVideoStream.getVideoTracks().forEach(track => track.stop());
    myVideoStream = stream;

    const localVideoElement = document.getElementById('video-user1'); // Assume your local video element has an id 'local-video'
    localVideoElement.srcObject = myVideoStream;

    const videoTrack = myVideoStream.getVideoTracks()[0];
    Object.values(peer.connections).forEach(connection => {
        connection.forEach(conn => {
            conn.peerConnection.getSenders().forEach(sender => {
                if (sender.track.kind === 'video') {
                    sender.replaceTrack(videoTrack);
                }
            });
        });
    });

};



const getCurrentAudioDeviceId = () => {
    try {
        let audioTrack = myVideoStream.getAudioTracks()[0];
        let settings = audioTrack.getSettings();
        return settings.deviceId;
    } catch (error) {
        console.error("Error getting current audio device ID:", error);
        return null;
    }
};
const getCurrentVideoDeviceId = () => {
    try {
        let videoTrack = myVideoStream.getVideoTracks()[0];
        let settings = videoTrack.getSettings();
        return settings.deviceId;
    } catch (error) {
        console.error("Error getting current video device ID:", error);
        return null;
    }
};

function getUserAudioAndCameraDevice() {
    navigator.mediaDevices.enumerateDevices()
        .then(devices => {
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            const cameraDevices = devices.filter(device => device.kind === 'videoinput');
            if (!audioDevices.length) {
                console.warn('No audio input devices found.');
                return; // Handle no devices scenario
            } else {
                const dropdown = document.getElementById('audioDevice');
                audioDevices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.text = device.label;
                    dropdown.appendChild(option);
                });
            }
            if (!cameraDevices.length) {
                console.warn('No audio input devices found.');
                return; // Handle no devices scenario
            } else {
                const dropdown = document.getElementById('videoCameraDevice');
                cameraDevices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.text = device.label;
                    dropdown.appendChild(option);
                });
            }
        });
}

const chatButton = () => {
    let mainRight = document.getElementById('mainRight');
    if (mainRight.style.display === "none" || mainRight.style.display === '') {
        mainRight.style.display = "block";
        mainRight.style.display = 'flex';
    }
    else {
        mainRight.style.display = "none"
    }

}

const setMuteButton = () => {
    const html = `
      <i class="fas fa-microphone"></i>
      <span>Mute</span>
    `
    document.querySelector('.main__mute_button').innerHTML = html;
}

const setUnmuteButton = () => {
    const html = `
      <i class="unmute fas fa-microphone-slash"></i>
      <span>Unmute</span>
    `
    document.querySelector('.main__mute_button').innerHTML = html;
}

const setParticipantMuteButton = () => {
    const html = `
      <i class="fas fa-microphone"></i>
      <span>Mute</span>
    `
    document.querySelector('.main__mute_button').innerHTML = html;
}

const setParticipantMuteUnmuteButton = (i, mic) => {

    if (mic === 'mute' || mic === undefined) {
        const html = `
        <i class="unmute fas fa-microphone-slash"></i>
        `
        document.querySelector(`.participantmicbtn-${i}`).innerHTML = html;
    } else {
        const html = `
        <i class="fas fa-microphone"></i>
      `
        document.querySelector(`.participantmicbtn-${i}`).innerHTML = html;
    }
}


const setStopVideo = () => {
    const html = `
      <i class="fas fa-video"></i>
      <span>Stop Video</span>
    `
    document.querySelector('.main__video_button').innerHTML = html;
}

const setPlayVideo = () => {
    const html = `
    <i class="stop fas fa-video-slash"></i>
      <span>Play Video</span>
    `
    document.querySelector('.main__video_button').innerHTML = html;
}

// Remove a participant
function removeParticipant(userId) {
    socket.emit('remove-participant', userId);
}

// Function to update the participant list UI
function updateParticipantList() {
    const ul = document.getElementById('participant-list-ul');
    ul.innerHTML = ''; // Clear the list

    // Add the specified user first
    if (participants[USER_EMAIL]) {
        newList[USER_EMAIL] = participants[USER_EMAIL];
    }

    // Add the rest of the users
    for (let key in participants) {
        if (key !== USER_EMAIL) {
            newList[key] = participants[key];
        }
    }
    participant = 0;
    for (const userId in newList) {
        const li = document.createElement('li');
        li.id = `participant-${userId}`;
        li.className = `participant-${++participant}`;
        li.innerHTML = `
            ${participants[userId].name === USER_NAME ? participants[userId].name + ' (me)' : participants[userId].name}
            ${participants[userId].isHost ? '<span>(Host)</span>' : ''}
            <div><button class="participantbtn participantmicbtn-${participant}" onclick="muteUnmuteParticipant('${participants[userId].userEmail}','muteUnmute',${participant})"> <i class="fas fa-microphone"></i></button>
            <button class="participantbtn" onclick="removeParticipant('${participants[userId].userEmail}')"> <i class="fas fa-video"></i></button></div>
        `;
        ul.appendChild(li);
    }
}

// Function to toggle the participant list
function toggleParticipantList() {
    socket.emit('participents-List');
    const participantList = document.getElementById('participant-list');
    if (participantList.style.display === 'none' || participantList.style.display === '') {
        participantList.style.display = 'block';
    } else {
        participantList.style.display = 'none';
    }
}

(async () => {
    try {
        cameraDeviceId = await getDefaultCameraDeviceId();
        console.log('Default camera device ID:', cameraDeviceId);
      
        await stremVideo(cameraDeviceId, "default");
        await getUserAudioAndCameraDevice();
    } catch (err) {
        console.error('Error in streaming video:', err);
    }
})();

// stremVideo(cameraDeviceId, "default");
// getUserAudioAndCameraDevice();

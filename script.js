let scene, camera, renderer, player, peer, conn;
let otherPlayers = {};
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocityY = 0, canJump = false;
let isConnected = false;
let gameStarted = false;

const clock = new THREE.Clock();

// PeerJS obyektini xavfsiz yaratish (Stun serverlar bilan)
function initPeer(onOpen) {
    const p = new Peer({
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    });

    p.on('error', (err) => {
        console.error("PeerJS xatosi:", err);
        alert("Ulanishda xatolik: " + err.type + "\nIltimos, sahifani yangilab boshqatdan urinib ko'ring.");
    });

    p.on('open', (id) => {
        if (onOpen) onOpen(id);
    });

    return p;
}

function createRoom() {
    document.querySelector('.btn-primary').innerText = "Xona ochilmoqda...";
    peer = initPeer((id) => {
        document.getElementById('roomCodeDisplay').innerText = "Sizning ID: " + id;
    });

    peer.on('connection', (incomingConn) => {
        conn = incomingConn;
        setupConnection();
        startGame();
    });
}

function joinRoom() {
    const peerId = document.getElementById('roomInput').value.trim();
    if (!peerId) return alert('Iltimos do\'stingizning ID sini kiriting!');

    peer = initPeer(() => {
        conn = peer.connect(peerId);
        setupConnection();
        startGame();
    });
}

function setupConnection() {
    isConnected = true;
    const statusEl = document.getElementById('connectionStatus');
    statusEl.innerText = "Ulandi! 🟢";
    statusEl.className = "status-online";

    conn.on('data', (data) => {
        if (!otherPlayers[data.id]) {
            const oGeo = new THREE.BoxGeometry(1, 2, 1);
            const oMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
            otherPlayers[data.id] = new THREE.Mesh(oGeo, oMat);
            scene.add(otherPlayers[data.id]);
        }
        otherPlayers[data.id].position.set(data.x, data.y, data.z);
    });
}

function startGame() {
    gameStarted = true;
    document.getElementById('menuContainer').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('crosshair').style.display = 'block';

    init3D();
    animate();
    document.body.requestPointerLock();
}

function init3D() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Yorug'lik
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(20, 50, 20);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x64748b));

    // O'yinchi
    const playerGeo = new THREE.BoxGeometry(1, 2, 1);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.position.set(0, 15, 0);
    scene.add(player);

    createStairsAndPlatforms();
    setupControls();
    window.addEventListener('resize', onWindowResize);
}

function createStairsAndPlatforms() {
    const mat1 = new THREE.MeshStandardMaterial({ color: 0x10b981 });
    const mat2 = new THREE.MeshStandardMaterial({ color: 0xf59e0b });

    let currentX = 0, currentY = 12, currentZ = 0;

    for (let i = 0; i < 60; i++) {
        const plat = new THREE.Mesh(
            new THREE.BoxGeometry(5, 0.8, 5),
            i % 2 === 0 ? mat1 : mat2
        );
        plat.position.set(currentX, currentY, currentZ);
        scene.add(plat);

        currentY -= 1.4;
        if (i % 2 === 0) {
            currentX += 4;
        } else {
            currentZ -= 4;
        }
    }
}

function setupControls() {
    let euler = new THREE.Euler(0, 0, 0, 'YXZ');

    document.body.addEventListener('click', () => {
        if (gameStarted) document.body.requestPointerLock();
    });

    document.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement === document.body) {
            const movementX = event.movementX || 0;
            const movementY = event.movementY || 0;

            euler.setFromQuaternion(camera.quaternion);
            euler.y -= movementX * 0.002;
            euler.x -= movementY * 0.002;
            euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
            camera.quaternion.setFromEuler(euler);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') moveForward = true;
        if (e.code === 'KeyS') moveBackward = true;
        if (e.code === 'KeyA') moveLeft = true;
        if (e.code === 'KeyD') moveRight = true;
        if (e.code === 'Space' && canJump) {
            velocityY = 0.12;
            canJump = false;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') moveForward = false;
        if (e.code === 'KeyS') moveBackward = false;
        if (e.code === 'KeyA') moveLeft = false;
        if (e.code === 'KeyD') moveRight = false;
    });
}

function animate() {
    requestAnimationFrame(animate);
    if (!gameStarted) return;

    const delta = clock.getDelta();

    const speed = 5.5 * delta;
    let moveDir = new THREE.Vector3();
    if (moveForward) moveDir.z -= 1;
    if (moveBackward) moveDir.z += 1;
    if (moveLeft) moveDir.x -= 1;
    if (moveRight) moveDir.x += 1;

    moveDir.normalize();
    moveDir.applyQuaternion(camera.quaternion);
    moveDir.y = 0;

    player.position.addScaledVector(moveDir, speed);

    velocityY -= 0.005;
    player.position.y += velocityY;

    if (player.position.y <= -75) {
        player.position.set(0, 15, 0);
        velocityY = 0;
    } else if (player.position.y <= 1.5 && player.position.y > 0) {
        canJump = true;
    }

    camera.position.copy(player.position);
    camera.position.y += 1.6;

    document.getElementById('heightScore').innerText = Math.floor(player.position.y);

    // Ma'lumotni to'g'ridan-to'g'ri do'stga yuborish
    if (isConnected && conn && conn.open) {
        conn.send({
            id: peer.id,
            x: Number(player.position.x.toFixed(2)),
            y: Number(player.position.y.toFixed(2)),
            z: Number(player.position.z.toFixed(2))
        });
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    if (!gameStarted) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

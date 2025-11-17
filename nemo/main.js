import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.164/examples/jsm/controls/OrbitControls.js";
import { PCDLoader } from "https://cdn.jsdelivr.net/npm/three@0.164/examples/jsm/loaders/PCDLoader.js";
import { PLYLoader } from "https://cdn.jsdelivr.net/npm/three@0.164/examples/jsm/loaders/PLYLoader.js";

let scene, camera, renderer, controls;
let currentPoints = null;

// -----------------------------------------------------------
// INITIALIZE SCENE
// -----------------------------------------------------------
function init() {
    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth - 260, window.innerHeight);
    document.getElementById("viewer").appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(
        75,
        (window.innerWidth - 260) / window.innerHeight,
        0.01,
        1000
    );
    camera.position.set(1, 1, 1);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.update();

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
}

// -----------------------------------------------------------
// LOADERS
// -----------------------------------------------------------
const pcdLoader = new PCDLoader();
const plyLoader = new PLYLoader();

function loadPointCloud(path) {
    if (currentPoints) scene.remove(currentPoints);

    const ext = path.split(".").pop().toLowerCase();

    if (ext === "pcd") {
        pcdLoader.load(path, (points) => {
            currentPoints = points;
            scene.add(points);
        });
    } else if (ext === "ply") {
        plyLoader.load(path, (geom) => {
            const material = new THREE.PointsMaterial({ size: 0.01 });
            currentPoints = new THREE.Points(geom, material);
            scene.add(currentPoints);
        });
    }
}

// -----------------------------------------------------------
// UI CONTROLS
// -----------------------------------------------------------
document.getElementById("loadExample").onclick = () => {
    const path = document.getElementById("exampleSelect").value;
    loadPointCloud(path);
};

document.getElementById("fileInput").onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
        const url = event.target.result;
        loadPointCloud(url);
    };
    reader.readAsDataURL(file);
};

document.getElementById("pointSizeSlider").oninput = (e) => {
    if (currentPoints?.material) {
        currentPoints.material.size = e.target.value / 100;
    }
};

document.getElementById("opacitySlider").oninput = (e) => {
    if (currentPoints?.material) {
        currentPoints.material.opacity = parseFloat(e.target.value);
        currentPoints.material.transparent = true;
    }
};

document.getElementById("bgColor").oninput = (e) => {
    scene.background = new THREE.Color(e.target.value);
};

// Responsive resize
window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth - 260, window.innerHeight);
    camera.aspect = (window.innerWidth - 260) / window.innerHeight;
    camera.updateProjectionMatrix();
});

init();


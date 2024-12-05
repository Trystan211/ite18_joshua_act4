import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js";

// === Basic Scene Setup ===
const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 15);
scene.add(camera);

// === Controls ===
new OrbitControls(camera, renderer.domElement);

// === Lighting ===
const dynamicLight = new THREE.PointLight(0xffffff, 8, 50);
dynamicLight.position.set(0, 10, 0);
scene.add(dynamicLight);

// === Ocean ===
const ocean = (() => {
    const geometry = new THREE.PlaneGeometry(75, 75, 300, 300);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            waveHeight: { value: 1.5 },
            waveFrequency: { value: 0.5 },
            deepColor: { value: new THREE.Color(0x8B8000) },
            shallowColor: { value: new THREE.Color(0xFFD700) },
        },
        vertexShader: `
            uniform float time;
            uniform float waveHeight;
            uniform float waveFrequency;
            varying vec2 vUv;

            void main() {
                vUv = uv;
                vec3 pos = position;
                pos.y += sin(pos.x * waveFrequency + time) * waveHeight * 0.8;
                pos.y += cos(pos.z * waveFrequency + time * 1.5) * waveHeight * 0.6;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 deepColor;
            uniform vec3 shallowColor;
            varying vec2 vUv;

            void main() {
                vec3 color = mix(deepColor, shallowColor, vUv.y * 0.8 + 0.2);
                gl_FragColor = vec4(color, 1.0);
            }
        `,
    });

    return new THREE.Mesh(geometry, material);
})();
scene.add(ocean);

// === Hotdog Model ===
let hotdog = null;

new GLTFLoader().load(
    'https://trystan211.github.io/ite18_joshua_act4/low_poly_hot_dog.glb',
    (gltf) => {
        hotdog = gltf.scene;
        hotdog.position.set(1, 1, 1);
        hotdog.scale.set(25, 25, 25);
        scene.add(hotdog);

        const box = new THREE.Box3().setFromObject(hotdog);
        console.log('Hotdog dimensions:', box.getSize(new THREE.Vector3()));
    },
    undefined,
    (error) => console.error("Failed to load hotdog model:", error)
);

// === Rain ===
const rain = (() => {
    const count = 10000;
    const positions = [];
    const velocities = [];

    for (let i = 0; i < count; i++) {
        positions.push(
            (Math.random() - 0.5) * 100,
            Math.random() * 50,
            (Math.random() - 0.5) * 100
        );
        velocities.push(-0.2 - Math.random() * 0.5);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xff0000,
        size: 0.2,
        transparent: true,
        opacity: 0.8,
    });

    const points = new THREE.Points(geometry, material);
    points.userData.velocities = velocities;

    return points;
})();
scene.add(rain);

// === Skybox ===
const skyboxMaterial = new THREE.ShaderMaterial({
    uniforms: {
        topColor: { value: new THREE.Color(0xff5733) }, // Ketchup red
        bottomColor: { value: new THREE.Color(0xffd700) }, // Mustard yellow
    },
    vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
            vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
            float height = normalize(vWorldPosition).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(height, 0.0)), 1.0);
        }
    `,
    side: THREE.BackSide,
});

const skybox = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 32), skyboxMaterial);
scene.add(skybox);

// === Animation ===
const clock = new THREE.Clock();

function animate() {
    const time = clock.getElapsedTime();
    ocean.material.uniforms.time.value = time;

    const rainPositions = rain.geometry.attributes.position.array;
    const rainVelocities = rain.userData.velocities;

    for (let i = 0; i < rainPositions.length / 3; i++) {
        const idx = i * 3 + 1; // Y coordinate
        rainPositions[idx] += rainVelocities[i];
        if (rainPositions[idx] < 0) rainPositions[idx] = 50;
    }
    rain.geometry.attributes.position.needsUpdate = true;

    dynamicLight.position.set(
        10 * Math.sin(time * 0.5),
        10,
        10 * Math.cos(time * 0.5)
    );

    if (hotdog) {
        hotdog.position.x = Math.sin(time * 0.5) * 5;
        hotdog.position.z = Math.cos(time * 0.5) * 5;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();

// === Responsive Resize ===
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

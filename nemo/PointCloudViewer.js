import * as THREE from './js/three.module.min.js';
import { OrbitControls } from './js/OrbitControls.js';

const STYLE_ID = 'pcv-global-styles';
const STRIP_H = 88;

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
        .pcv-root {
            position: relative;
            width: 100%;
            height: 100%;
            background: #ffffff;
            overflow: hidden;
        }
        .pcv-canvas-area {
            position: absolute;
            inset: 0;
            bottom: ${STRIP_H}px;
        }
        .pcv-canvas-area canvas {
            display: block;
        }
        .pcv-strip {
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: ${STRIP_H}px;
            display: flex;
            background: #f5f5f5;
            border-top: 1px solid #e8e8e8;
        }
        .pcv-thumb {
            flex: 1;
            background-size: contain;
            background-position: center;
            background-repeat: no-repeat;
            background-color: #f5f5f5;
            position: relative;
            border-right: 1px solid #e8e8e8;
        }
        .pcv-thumb:last-child { border-right: none; }
        .pcv-thumb-border {
            position: absolute;
            inset: 0;
            border: 3px solid transparent;
            pointer-events: none;
        }
        .pcv-loading {
            position: absolute;
            inset: 0;
            bottom: ${STRIP_H}px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            z-index: 10;
            transition: opacity 0.6s ease;
        }
        .pcv-spinner {
            width: 28px;
            height: 28px;
            border: 2px solid rgba(0,0,0,0.08);
            border-top-color: rgba(0,0,0,0.4);
            border-radius: 50%;
            animation: pcv-spin 0.75s linear infinite;
        }
        @keyframes pcv-spin { to { transform: rotate(360deg); } }
        .pcv-hint {
            position: absolute;
            bottom: ${STRIP_H + 12}px;
            left: 0; right: 0;
            text-align: center;
            color: rgba(0,0,0,0.28);
            font-size: 11px;
            font-family: Inter, sans-serif;
            letter-spacing: 0.6px;
            pointer-events: none;
            animation: pcv-hint-fade 4s ease-out 1.5s both;
        }
        @keyframes pcv-hint-fade { from { opacity: 1; } to { opacity: 0; } }
    `;
    document.head.appendChild(el);
}

export class PointCloudViewer {
    constructor(container, dataUrl, imageUrls = [], { active = true } = {}) {
        this.container = container;
        this.dataUrl = dataUrl;
        this.imageUrls = imageUrls;

        // The render loop runs only while the viewer is the active carousel
        // slide AND on screen; otherwise it costs nothing.
        this.active = active;
        this.onScreen = false;
        this._rafId = null;
        this._tick = () => {
            this._rafId = requestAnimationFrame(this._tick);
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };

        this.palette = [
            new THREE.Color(0.000, 0.447, 0.741),
            new THREE.Color(0.850, 0.325, 0.098),
            new THREE.Color(0.929, 0.694, 0.125),
            new THREE.Color(0.494, 0.184, 0.556),
            new THREE.Color(0.466, 0.674, 0.188),
            new THREE.Color(0.301, 0.745, 0.933),
            new THREE.Color(0.635, 0.078, 0.184),
        ];

        injectStyles();
        this._buildDOM();
        this._initThree();
        this._loadImages();
        this._loadPointCloud();

        new ResizeObserver(() => this.resizeAndRender()).observe(this.container);
        new IntersectionObserver(([entry]) => {
            this.onScreen = entry.isIntersecting;
            this._updateLoop();
        }).observe(this.container);
    }

    setActive(active) {
        this.active = active;
        if (active) this.resizeAndRender();
        this._updateLoop();
    }

    _updateLoop() {
        const shouldRun = this.active && this.onScreen;
        if (shouldRun && this._rafId === null) {
            this._tick();
        } else if (!shouldRun && this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    _buildDOM() {
        this.container.classList.add('pcv-root');

        this.canvasArea = document.createElement('div');
        this.canvasArea.className = 'pcv-canvas-area';

        this.strip = document.createElement('div');
        this.strip.className = 'pcv-strip';

        this.loadingEl = document.createElement('div');
        this.loadingEl.className = 'pcv-loading';
        this.loadingEl.innerHTML = '<div class="pcv-spinner"></div>';

        this.hint = document.createElement('div');
        this.hint.className = 'pcv-hint';
        this.hint.textContent = 'drag to rotate · scroll to zoom';

        this.container.appendChild(this.canvasArea);
        this.container.appendChild(this.strip);
        this.container.appendChild(this.loadingEl);
        this.container.appendChild(this.hint);
    }

    _canvasSize() {
        const rect = this.container.getBoundingClientRect();
        const w = rect.width || 700;
        const h = Math.max((rect.height || 500) - STRIP_H, 100);
        return [w, h];
    }

    _initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        const [w, h] = this._canvasSize();
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(w, h);
        this.canvasArea.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 100);
        this.camera.up.set(0, -1, 0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = -1.2;
    }

    _loadImages() {
        this.strip.innerHTML = '';
        this.imageUrls.forEach((url, i) => {
            const div = document.createElement('div');
            div.className = 'pcv-thumb';
            div.style.backgroundImage = `url('${url}')`;

            const border = document.createElement('div');
            border.className = 'pcv-thumb-border';
            border.style.borderColor = `#${this.palette[i % this.palette.length].getHexString()}`;
            div.appendChild(border);

            this.strip.appendChild(div);
        });
    }

    resizeAndRender() {
        const [w, h] = this._canvasSize();
        const dpr = Math.min(window.devicePixelRatio, 2);
        this.renderer.setPixelRatio(dpr);
        if (this.pointMaterial) this.pointMaterial.uniforms.uPixelRatio.value = dpr;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.render(this.scene, this.camera);
    }

    // Binary layout (little-endian), written by the export script:
    //   uint32 N, uint32 P, float32[P*16] camera poses (row-major 4x4),
    //   float32[N*3] positions, uint8[N*3] colors
    async _fetchPointCloud() {
        const resp = await fetch(this.dataUrl);
        if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText} for ${this.dataUrl}`);
        const buf = await resp.arrayBuffer();
        const [n, p] = new Uint32Array(buf, 0, 2);
        let off = 8;
        const poseData = new Float32Array(buf, off, p * 16); off += p * 64;
        const positions = new Float32Array(buf, off, n * 3); off += n * 12;
        const colors = new Uint8Array(buf, off, n * 3);
        const poses = [];
        for (let i = 0; i < p; i++) {
            const m = poseData.subarray(i * 16, i * 16 + 16);
            poses.push([0, 1, 2, 3].map(r => [m[r*4], m[r*4+1], m[r*4+2], m[r*4+3]]));
        }
        return { positions, colors, poses };
    }

    async _loadPointCloud() {
        if (!this.dataUrl) return;
        try {
            const { positions, colors, poses } = await this._fetchPointCloud();

            let maxAbs = 0;
            for (let i = 0; i < positions.length; i++) maxAbs = Math.max(maxAbs, Math.abs(positions[i]));
            const scl = maxAbs > 0 ? 1 / maxAbs : 1;
            for (let i = 0; i < positions.length; i++) positions[i] *= scl;

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
            geometry.computeBoundingSphere();

            const material = new THREE.ShaderMaterial({
                vertexColors: true,
                depthWrite: false,
                transparent: true,
                uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
                vertexShader: `
                    uniform float uPixelRatio;
                    varying vec3 vColor;
                    void main() {
                        vColor = color;
                        vec4 mv = modelViewMatrix * vec4(position, 1.0);
                        gl_PointSize = 0.02 * (300.0 / -mv.z) * uPixelRatio;
                        gl_Position = projectionMatrix * mv;
                    }
                `,
                fragmentShader: `
                    varying vec3 vColor;
                    void main() {
                        float d = length(gl_PointCoord - vec2(0.5));
                        if (d > 0.5) discard;
                        float a = 1.0 - smoothstep(0.15, 0.5, d);
                        gl_FragColor = vec4(vColor, a);
                    }
                `
            });

            this.pointMaterial = material;
            this.scene.add(new THREE.Points(geometry, material));

            if (poses && poses.length) {
                const fs = 1.5;
                poses.forEach((m, i) => {
                    const mat = new THREE.Matrix4();
                    mat.fromArray([
                        m[0][0], m[1][0], m[2][0], m[3][0],
                        m[0][1], m[1][1], m[2][1], m[3][1],
                        m[0][2], m[1][2], m[2][2], m[3][2],
                        m[0][3], m[1][3], m[2][3], m[3][3],
                    ]);
                    mat.elements[12] *= fs;
                    mat.elements[13] *= fs;
                    mat.elements[14] *= fs;

                    const s = 0.1, far = 0.1;
                    const c = [
                        new THREE.Vector3(-s, -s, far), new THREE.Vector3(s, -s, far),
                        new THREE.Vector3(s, s, far), new THREE.Vector3(-s, s, far),
                        new THREE.Vector3(0, 0, 0)
                    ];
                    c.forEach(v => v.applyMatrix4(mat));

                    const edges = [[0,4],[1,4],[2,4],[3,4],[0,1],[1,2],[2,3],[3,0]];
                    const pos = new Float32Array(edges.length * 6);
                    edges.forEach(([a, b], j) => {
                        pos[j*6+0]=c[a].x; pos[j*6+1]=c[a].y; pos[j*6+2]=c[a].z;
                        pos[j*6+3]=c[b].x; pos[j*6+4]=c[b].y; pos[j*6+5]=c[b].z;
                    });
                    const geom = new THREE.BufferGeometry();
                    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                    this.scene.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({
                        color: this.palette[i % this.palette.length],
                        transparent: true,
                        opacity: 0.8,
                    })));
                });
            }

            const { center, radius } = geometry.boundingSphere;
            this.controls.target.copy(center);
            this.camera.position.set(
                center.x,
                center.y - radius * 0.25,
                center.z + radius * 2.8
            );
            this.controls.update();

            this.loadingEl.style.opacity = '0';
            setTimeout(() => this.loadingEl.remove(), 650);

            requestAnimationFrame(() => this.resizeAndRender());
        } catch (err) {
            console.error('PointCloudViewer load error:', err);
            this.loadingEl.textContent = 'Could not load point cloud.';
        }
    }
}

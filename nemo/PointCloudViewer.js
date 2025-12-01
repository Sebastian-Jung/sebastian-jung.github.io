// PointCloudViewer.js
import * as THREE from './js/three.module.js';
import { OrbitControls } from './js/OrbitControls.js';

export class PointCloudViewer {
    /**
     * container: DOM element where the viewer will be mounted.
     * jsonUrl: path to points.json
     * imageUrls: array of image URLs to show in the left panel
     * options: optional { imagePanelWidth, defaultHeight }
     */
    constructor(container, jsonUrl, imageUrls = [], options = {}) {
        this.container = container;
        this.jsonUrl = jsonUrl;
        this.imageUrls = imageUrls;

        this.options = Object.assign({
            imagePanelWidth: 200,
            defaultHeight: 500
        }, options);

        // Replace this.colors = [...] with:
        this.colors = [
            new THREE.Color(0.000, 0.447, 0.741),  // blue
            new THREE.Color(0.850, 0.325, 0.098),  // orange
            new THREE.Color(0.929, 0.694, 0.125),  // yellow
            new THREE.Color(0.494, 0.184, 0.556),  // purple
            new THREE.Color(0.466, 0.674, 0.188),  // green
            new THREE.Color(0.301, 0.745, 0.933),  // cyan
            new THREE.Color(0.635, 0.078, 0.184),  // red
            new THREE.Color(0.500, 0.500, 0.500),  // gray
            new THREE.Color(0.666, 0.333, 0.000),  // brown
            new THREE.Color(0.333, 0.333, 0.000),  // olive
            new THREE.Color(0.000, 0.500, 0.500),  // teal
            new THREE.Color(0.600, 0.600, 0.000),  // mustard
            new THREE.Color(0.000, 0.000, 0.000),  // black
            new THREE.Color(1.000, 0.000, 1.000),  // magenta
            new THREE.Color(0.502, 0.000, 0.502),  // dark magenta
            new THREE.Color(0.000, 0.000, 1.000),  // deep blue
            new THREE.Color(1.000, 0.647, 0.000),  // orange (light)
            new THREE.Color(0.824, 0.706, 0.549),  // tan
            new THREE.Color(0.118, 0.565, 1.000),  // dodger blue
            new THREE.Color(0.255, 0.412, 0.882),  // royal blue
        ];

        // make sure container has a height
        if (!this.container.style.height && this.container.clientHeight === 0) {
            this.container.style.height = this.options.defaultHeight + 'px';
        }

        // Inject CSS
        const style = document.createElement('style');
        style.textContent = `
            .pcv-container {
                display: flex;
                flex-direction: row;
                width: 100%;
                height: 100%;
                box-sizing: border-box;
                overflow: hidden;
            }
            .pcv-image-panel {
                width: ${this.options.imagePanelWidth}px;
                background: #f5f5f5;
                padding: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: 0;
                box-sizing: border-box;
                overflow: hidden;
            }
            .pcv-image-panel img {
                width: 100%;
                height: auto;
                display: block;
                margin: 0;
                padding: 0;
                object-fit: contain;
                box-sizing: border-box;
            }
            .pcv-canvas-wrapper {
                flex: 1 1 auto;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                box-sizing: border-box;
                overflow: hidden;
                padding: 0;
                margin: 0;
            }
            .pcv-canvas-container {
                width: auto;
                height: auto;
                box-sizing: border-box;
                display: block;
            }
            .pcv-canvas-container canvas {
                display: block;
                width: 100% !important;
                height: 100% !important;
            }
        `;
        document.head.appendChild(style);

        // Compose DOM
        this.container.classList.add('pcv-container');

        this.imagePanel = document.createElement('div');
        this.imagePanel.className = 'pcv-image-panel';

        this.canvasWrapper = document.createElement('div');
        this.canvasWrapper.className = 'pcv-canvas-wrapper';

        this.canvasContainer = document.createElement('div');
        this.canvasContainer.className = 'pcv-canvas-container';

        this.canvasWrapper.appendChild(this.canvasContainer);

        this.container.appendChild(this.imagePanel);
        this.container.appendChild(this.canvasWrapper);

        // Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        this.initThree();

        this.loadImages();
        this.loadPointCloud();

        window.addEventListener('resize', () => this.resizeAndRender());

        this.animate();
    }

    initThree() {
        const size = this.computeSquareSize();
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.setSize(size, size);
        this.canvasContainer.style.width = size + 'px';
        this.canvasContainer.style.height = size + 'px';
        this.canvasContainer.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(75, 1.0, 0.1, 1000);
        this.camera.aspect = 1.0;
        this.camera.position.set(0, 0, 3);
        this.camera.up.set(0, -1, 0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = -1.0;

        this.onWindowResize();
    }

    computeSquareSize() {
        const containerRect = this.container.getBoundingClientRect();
        let availH = containerRect.height || this.container.clientHeight || this.options.defaultHeight;
        let availW = containerRect.width || this.container.clientWidth || (this.options.imagePanelWidth + 300);
        const canvasAvailW = Math.max(0, availW - this.options.imagePanelWidth);
        return Math.max(32, Math.floor(Math.min(availH, canvasAvailW)));
    }

    resizeAndRender() {
        const size = this.computeSquareSize();
        this.canvasContainer.style.width = size + 'px';
        this.canvasContainer.style.height = size + 'px';
        this.renderer.setSize(size, size);
        this.camera.aspect = 1.0;
        this.camera.updateProjectionMatrix();

        // resize images to fit panel
        const panelHeight = Math.max(1, this.imagePanel.clientHeight || this.container.clientHeight);
        const n = Math.max(1, this.imageUrls.length);
        const maxH = Math.floor(panelHeight / n);
        this.imagePanel.querySelectorAll('img').forEach((img, i) => {
            img.style.maxHeight = maxH + 'px';
            img.style.height = 'auto';
            img.style.border = `10px solid #${this.colors[i % this.colors.length].getHexString()}`;
        });

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.resizeAndRender();
    }

    loadImages() {
        this.imagePanel.innerHTML = '';
        if (!this.imageUrls || this.imageUrls.length === 0) return;

        this.imageUrls.forEach((url, i) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = '';
            img.loading = 'lazy';
            img.style.display = 'block';
            img.style.margin = '0';
            img.style.padding = '0';
            img.style.objectFit = 'contain';
            img.style.border = `3px solid ${this.colors[i % this.colors.length]}`;
            this.imagePanel.appendChild(img);
        });

        requestAnimationFrame(() => this.resizeAndRender());
    }

    async loadPointCloud() {
        if (!this.jsonUrl) return;

        try {
            const resp = await fetch(this.jsonUrl);
            if (!resp.ok) throw new Error(`fetch ${this.jsonUrl} -> ${resp.status}`);
            const data = await resp.json();

            const points = data.points || [];
            const colors = data.colors || [];
            const cameraPoses = data.camera_poses || null;

            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(points.length * 3);
            const vertexColors = new Float32Array(points.length * 3);

            let maxAbs = 0;
            for (let i = 0; i < points.length; i++) {
                maxAbs = Math.max(
                    maxAbs,
                    Math.abs(points[i][0] || 0),
                    Math.abs(points[i][1] || 0),
                    Math.abs(points[i][2] || 0)
                );
            }
            const scale = maxAbs > 0 ? 1 / maxAbs : 1;

            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                positions[i * 3 + 0] = (p[0] || 0) * scale;
                positions[i * 3 + 1] = (p[1] || 0) * scale;
                positions[i * 3 + 2] = (p[2] || 0) * scale;

                const c = colors[i] || [1, 1, 1];
                vertexColors[i * 3 + 0] = c[0] > 1 ? c[0]/255 : c[0];
                vertexColors[i * 3 + 1] = c[1] > 1 ? c[1]/255 : c[1];
                vertexColors[i * 3 + 2] = c[2] > 1 ? c[2]/255 : c[2];
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
            geometry.computeBoundingSphere();

            const material = new THREE.ShaderMaterial({
                vertexColors: true,
                transparent: true,
                uniforms: { size: { value: 0.01 } },
                vertexShader: `
                    uniform float size;
                    varying vec3 vColor;
                    void main() {
                        vColor = color;
                        vec4 mv = modelViewMatrix * vec4(position,1.0);
                        gl_PointSize = size * (300.0 / -mv.z);
                        gl_Position = projectionMatrix * mv;
                    }
                `,
                fragmentShader: `
                    varying vec3 vColor;
                    void main() {
                        float r = length(gl_PointCoord - vec2(.5));
                        if (r > .5) discard;
                        gl_FragColor = vec4(vColor, 1.0);
                    }
                `
            });

            const pointsMesh = new THREE.Points(geometry, material);
            this.scene.add(pointsMesh);

            // frustums
            if (cameraPoses && cameraPoses.length) {
                const frustumScale = 1.5;
                cameraPoses.forEach((matrixArray, i) => {
                    const mat = new THREE.Matrix4();
                    const flat = [
                        matrixArray[0][0], matrixArray[1][0], matrixArray[2][0], matrixArray[3][0],
                        matrixArray[0][1], matrixArray[1][1], matrixArray[2][1], matrixArray[3][1],
                        matrixArray[0][2], matrixArray[1][2], matrixArray[2][2], matrixArray[3][2],
                        matrixArray[0][3], matrixArray[1][3], matrixArray[2][3], matrixArray[3][3],
                    ];
                    mat.fromArray(flat);
                    mat.elements[12] *= frustumScale;
                    mat.elements[13] *= frustumScale;
                    mat.elements[14] *= frustumScale;

                    const s = 0.1, far = 0.1;
                    const corners = [
                        new THREE.Vector3(-s, -s, far),
                        new THREE.Vector3(s, -s, far),
                        new THREE.Vector3(s, s, far),
                        new THREE.Vector3(-s, s, far),
                        new THREE.Vector3(0,0,0)
                    ];
                    corners.forEach(c => c.applyMatrix4(mat));

                    const lines = [[0,4],[1,4],[2,4],[3,4],[0,1],[1,2],[2,3],[3,0]];
                    const geom = new THREE.BufferGeometry();
                    const pos = new Float32Array(lines.length * 6);
                    lines.forEach((l,j)=>{
                        pos[j*6+0]=corners[l[0]].x;
                        pos[j*6+1]=corners[l[0]].y;
                        pos[j*6+2]=corners[l[0]].z;
                        pos[j*6+3]=corners[l[1]].x;
                        pos[j*6+4]=corners[l[1]].y;
                        pos[j*6+5]=corners[l[1]].z;
                    });
                    geom.setAttribute('position', new THREE.BufferAttribute(pos,3));
                    const lineMat = new THREE.LineBasicMaterial({ color: this.colors[i % this.colors.length] });
                    this.scene.add(new THREE.LineSegments(geom,lineMat));
                });
            }

            // position camera
            const center = geometry.boundingSphere ? geometry.boundingSphere.center : new THREE.Vector3(0,0,0);
            const radius = geometry.boundingSphere ? geometry.boundingSphere.radius : 1.0;
            this.controls.target.copy(center);
            this.camera.position.set(center.x, center.y, center.z - radius * 2.5);
            this.controls.update();

            requestAnimationFrame(() => this.resizeAndRender());

        } catch(err) {
            console.error('PointCloudViewer: failed to load JSON', err);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

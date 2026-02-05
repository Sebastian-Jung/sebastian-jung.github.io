// PointCloudViewer.js
import * as THREE from './js/three.module.js';
import { OrbitControls } from './js/OrbitControls.js';

export class PointCloudViewer {
    constructor(container, jsonUrl, imageUrls = [], options = {}) {
        this.container = container;
        this.jsonUrl = jsonUrl;
        this.imageUrls = imageUrls;

        this.options = Object.assign({
            imagePanelWidth: 200,
            defaultHeight: 500
        }, options);

        this.colors = [
            new THREE.Color(0.000, 0.447, 0.741), new THREE.Color(0.850, 0.325, 0.098),
            new THREE.Color(0.929, 0.694, 0.125), new THREE.Color(0.494, 0.184, 0.556),
            new THREE.Color(0.466, 0.674, 0.188), new THREE.Color(0.301, 0.745, 0.933),
            new THREE.Color(0.635, 0.078, 0.184), new THREE.Color(0.500, 0.500, 0.500),
            new THREE.Color(0.666, 0.333, 0.000), new THREE.Color(0.333, 0.333, 0.000),
            new THREE.Color(0.000, 0.500, 0.500), new THREE.Color(0.600, 0.600, 0.000),
            new THREE.Color(0.000, 0.000, 0.000), new THREE.Color(1.000, 0.000, 1.000),
            new THREE.Color(0.502, 0.000, 0.502), new THREE.Color(0.000, 0.000, 1.000),
            new THREE.Color(1.000, 0.647, 0.000), new THREE.Color(0.824, 0.706, 0.549),
            new THREE.Color(0.118, 0.565, 1.000), new THREE.Color(0.255, 0.412, 0.882),
        ];

        const style = document.createElement('style');
        style.textContent = `
            .pcv-container {
                position: relative !important;
                width: 100%;
                height: 100%;
                box-sizing: border-box;
                overflow: hidden;
                display: block;
                background: #ffffff;
            }
            .pcv-image-panel {
                position: absolute;
                top: 0;
                left: 0;
                width: ${this.options.imagePanelWidth}px !important;
                height: 100%;
                background: #f8f8f8;
                display: flex;
                flex-direction: column;
                z-index: 100; /* Ensure images are on top of canvas */
                border-right: 1px solid #ddd;
                box-sizing: border-box;
            }
            .pcv-img-item {
                flex: 1 1 0%; /* Force items to take up equal vertical space */
                width: 100%;
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                box-sizing: border-box;
            }
            .pcv-canvas-wrapper {
                width: 100%;
                height: 100%;
                padding-left: ${this.options.imagePanelWidth}px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                z-index: 1;
            }
        `;
        document.head.appendChild(style);

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
        this.canvasContainer.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(75, 1.0, 0.1, 1000);
        this.camera.position.set(0, 0, 3);
        this.camera.up.set(0, -1, 0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = -1.0;
    }

    computeSquareSize() {
        const rect = this.container.getBoundingClientRect();
        const availW = rect.width - this.options.imagePanelWidth;
        const availH = rect.height;
        return Math.floor(Math.min(availW, availH)) - 10;
    }

    loadImages() {
        this.imagePanel.innerHTML = '';
        if (!this.imageUrls) return;
        this.imageUrls.forEach((url, i) => {
            const div = document.createElement('div');
            div.className = 'pcv-img-item';
            div.style.backgroundImage = `url('${url}')`;
            
            const color = this.colors[i % this.colors.length].getHexString();
            div.style.boxShadow = `inset 0 0 0 4px #${color}`;
            
            this.imagePanel.appendChild(div);
        });
    }

    resizeAndRender() {
        const size = this.computeSquareSize();
        this.renderer.setSize(size, size);
        this.canvasContainer.style.width = size + 'px';
        this.canvasContainer.style.height = size + 'px';
        this.camera.updateProjectionMatrix();
        this.renderer.render(this.scene, this.camera);
    }

    async loadPointCloud() {
        if (!this.jsonUrl) return;
        try {
            const resp = await fetch(this.jsonUrl);
            const data = await resp.json();
            const points = data.points || [];
            const colors = data.colors || [];
            const cameraPoses = data.camera_poses || null;

            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(points.length * 3);
            const vertexColors = new Float32Array(points.length * 3);

            let maxAbs = 0;
            points.forEach(p => {
                maxAbs = Math.max(maxAbs, Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]));
            });
            const scale = maxAbs > 0 ? 1 / maxAbs : 1;

            for (let i = 0; i < points.length; i++) {
                positions[i * 3 + 0] = points[i][0] * scale;
                positions[i * 3 + 1] = points[i][1] * scale;
                positions[i * 3 + 2] = points[i][2] * scale;
                const c = colors[i] || [1, 1, 1];
                vertexColors[i * 3 + 0] = c[0] > 1 ? c[0]/255 : c[0];
                vertexColors[i * 3 + 1] = c[1] > 1 ? c[1]/255 : c[1];
                vertexColors[i * 3 + 2] = c[2] > 1 ? c[2]/255 : c[2];
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
            
            const material = new THREE.ShaderMaterial({
                vertexColors: true,
                uniforms: { size: { value: 0.01 } },
                vertexShader: `
                    varying vec3 vColor;
                    void main() {
                        vColor = color;
                        vec4 mv = modelViewMatrix * vec4(position,1.0);
                        gl_PointSize = 0.01 * (300.0 / -mv.z);
                        gl_Position = projectionMatrix * mv;
                    }
                `,
                fragmentShader: `
                    varying vec3 vColor;
                    void main() {
                        if (length(gl_PointCoord - vec2(.5)) > .5) discard;
                        gl_FragColor = vec4(vColor, 1.0);
                    }
                `
            });

            this.scene.add(new THREE.Points(geometry, material));

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
        } catch(err) { console.error(err); }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
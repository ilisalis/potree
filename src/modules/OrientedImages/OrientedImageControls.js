
import * as THREE from "../../../libs/three.js/build/three.module.js";
import {MOUSE} from "../../defines.js";
import {EventDispatcher} from "../../EventDispatcher.js";

 
export class OrientedImageControls extends EventDispatcher{
	
	constructor(viewer){
		super();
		
		this.hoveredElement = null;
		
		this.viewer = viewer;
		this.renderer = viewer.renderer;
		
		this.originalCam = viewer.scene.getActiveCamera();
		
		this.shearCam = viewer.scene.getActiveCamera().clone();
		this.shearCam.rotation.set(this.originalCam.rotation.toArray());
		this.shearCam.updateProjectionMatrix();
		this.shearCam.updateProjectionMatrix = () => {
			return this.shearCam.projectionMatrix;
		};

		this.image = null;

		this.fadeFactor = 20;
		this.fovDelta = 0;

		this.fovMin = 0.1;
		this.fovMax = 120;

		this.shear = [0, 0];
		this.ang = 0.0;
		this.angDelta = 0.0;

		// const style = ``;
		/*this.elUp =    $(`<input type="button" value="🡅" style="position: absolute; top: 10px; left: calc(50%); z-index: 1000" />`);
		this.elRight = $(`<input type="button" value="🡆" style="position: absolute; top: calc(50%); right: 10px; z-index: 1000" />`);
		this.elDown =  $(`<input type="button" value="🡇" style="position: absolute; bottom: 10px; left: calc(50%); z-index: 1000" />`);
		this.elLeft =  $(`<input type="button" value="🡄" style="position: absolute; top: calc(50%); left: 10px; z-index: 1000" />`);*/
		this.elExit = $(`<input type="button" data-i18n="[value]tt.back_3d_view" style="position: absolute; bottom: 10px; right: 10px; z-index: 1000" />`);

		this.elExit.click( () => {
			this.release();
		});

		/*this.elUp.click(() => {
			const fovY = viewer.getFOV();
			const top = Math.tan(THREE.Math.degToRad(fovY / 2));
			this.shear[1] += 0.1 * top;
		});

		this.elRight.click(() => {
			const fovY = viewer.getFOV();
			const top = Math.tan(THREE.Math.degToRad(fovY / 2));
			this.shear[0] += 0.1 * top;
		});

		this.elDown.click(() => {
			const fovY = viewer.getFOV();
			const top = Math.tan(THREE.Math.degToRad(fovY / 2));
			this.shear[1] -= 0.1 * top;
		});

		this.elLeft.click(() => {
			const fovY = viewer.getFOV();
			const top = Math.tan(THREE.Math.degToRad(fovY / 2));
			this.shear[0] -= 0.1 * top;
		});*/

		this.scene = null;
		this.sceneControls = new THREE.Scene();

		let drag = (e) => {
			if (e.drag.startHandled === undefined) {
				e.drag.startHandled = true;
			}

			let ndrag = {
				x: e.drag.lastDrag.x / this.renderer.domElement.clientWidth,
				y: e.drag.lastDrag.y / this.renderer.domElement.clientHeight
			};

			if (e.drag.mouse === MOUSE.LEFT) {				
				const fovY = viewer.getFOV();
				const top = Math.tan(THREE.Math.degToRad(fovY / 2));				
				this.shear[0] -= ndrag.x * top * 2.5;
				this.shear[1] += ndrag.y * top * 2.5;
			} else if (e.drag.mouse === MOUSE.RIGHT) {
				let a = new THREE.Vector2( e.drag.start.x - 0.5 * this.renderer.domElement.clientWidth, 
										  -e.drag.start.y + 0.5 * this.renderer.domElement.clientHeight);
				let b = new THREE.Vector2( e.drag.end.x - 0.5 * this.renderer.domElement.clientWidth, 
										  -e.drag.end.y + 0.5 * this.renderer.domElement.clientHeight);
				let angAB = Math.acos(a.dot(b) / (a.length() * b.length()));
				let sign = 0;
				
				if(Math.abs(Math.abs(a.angle() - b.angle()) - angAB) < 0.001) {
					sign = -Math.sign(a.angle() - b.angle());
				} else {
					sign = Math.sign(a.angle() - b.angle());
				}
				
				this.angDelta = sign * angAB;
			}
		};
		
		let drop = e => {
			this.ang += this.angDelta;
			this.angDelta = 0.0;
		};

		let scroll = (e) => {
			this.fovDelta += -e.delta * 1.0;
		};
		
		let dblclick = (e) => {
			if(!this.hoveredElement){
				this.release();
			}			
		};

		this.addEventListener('mousewheel', scroll);
		this.addEventListener('drag', drag);
		this.addEventListener('drop', drop);
		this.addEventListener('dblclick', dblclick);
	}

	hasSomethingCaptured(){
		return this.image !== null;
	}
	
	isNewCapture(image){
		return this.image !== image;
	}

	capture(image){
		if(!this.isNewCapture(image)){
			return;
		}
		
		if(!this.hasSomethingCaptured()){
			this.originalFOV = this.viewer.getFOV();
			this.originalControls = this.viewer.getControls();
		}

		this.image = image;

		this.viewer.setControls(this);
		this.viewer.scene.overrideCamera = this.shearCam;

		const elCanvas = this.viewer.renderer.domElement;
		const elRoot = $(elCanvas.parentElement);

		this.shear = [0, 0];
		//this.ang = 0;

		//elRoot.append(this.elUp);
		//elRoot.append(this.elRight);
		//elRoot.append(this.elDown);
		//elRoot.append(this.elLeft);
		elRoot.append(this.elExit);
		
		elRoot.i18n();		
	}

	release(){
		this.image = null;

		this.viewer.scene.overrideCamera = null;

		/*this.elUp.detach();
		this.elRight.detach();
		this.elDown.detach();
		this.elLeft.detach();*/
		this.elExit.detach();

		this.viewer.setFOV(this.originalFOV);
		this.viewer.setControls(this.originalControls);
	}

	setScene (scene) {
		this.scene = scene;
	}

	update (delta) {
		// const view = this.scene.view;

		// let prevTotal = this.shearCam.projectionMatrix.elements.reduce( (a, i) => a + i, 0);

		//const progression = Math.min(1, this.fadeFactor * delta);
		//const attenuation = Math.max(0, 1 - this.fadeFactor * delta);
		const progression = 1;
		const attenuation = 0;

		const oldFov = this.viewer.getFOV();
		let fovProgression =  progression * this.fovDelta;
		let newFov = oldFov * ((1 + fovProgression / 10));

		newFov = Math.max(this.fovMin, newFov);
		newFov = Math.min(this.fovMax, newFov);

		let diff = newFov / oldFov;

		const mouse = this.viewer.inputHandler.mouse;
		const canvasSize = this.viewer.renderer.getSize(new THREE.Vector2());
		const uv = [
			(mouse.x / canvasSize.x),
			((canvasSize.y - mouse.y) / canvasSize.y)
		];

		const fovY = newFov;
		const aspect = canvasSize.x / canvasSize.y;
		const top = Math.tan(THREE.Math.degToRad(fovY / 2));
		const height = 2 * top;
		const width = aspect * height;

		const shearRangeX = [
			this.shear[0] - 0.5 * width,
			this.shear[0] + 0.5 * width,
		];

		const shearRangeY = [
			this.shear[1] - 0.5 * height,
			this.shear[1] + 0.5 * height,
		];

		const shx = (1 - uv[0]) * shearRangeX[0] + uv[0] * shearRangeX[1];
		const shy = (1 - uv[1]) * shearRangeY[0] + uv[1] * shearRangeY[1];

		const shu = (1 - diff);

		const newShear =  [
			(1 - shu) * this.shear[0] + shu * shx,
			(1 - shu) * this.shear[1] + shu * shy,
		];
		
		this.shear = newShear;
		this.viewer.setFOV(newFov);
		
		const {originalCam, shearCam} = this;

		originalCam.fov = newFov;
		originalCam.updateMatrixWorld()
		originalCam.updateProjectionMatrix();
		shearCam.copy(originalCam);
		shearCam.rotation.set(...originalCam.rotation.toArray());

		shearCam.updateMatrixWorld();
		shearCam.projectionMatrix.copy(originalCam.projectionMatrix);

		const [sx, sy] = this.shear;
		const mShear = new THREE.Matrix4().set(
			1.0, 0.0, sx,  0.0,
			0.0, 1.0, sy,  0.0,
			0.0, 0.0, 1.0, 0.0,
			0.0, 0.0, 0.0, 1.0,
		);
		
		const mRot = new THREE.Matrix4().set(
			Math.cos(this.ang + this.angDelta), -Math.sin(this.ang + this.angDelta), 0.0, 0.0,  
			Math.sin(this.ang + this.angDelta),  Math.cos(this.ang + this.angDelta), 0.0, 0.0,  
			0.0, 0.0, 1.0, 0.0,  
			0.0, 0.0, 0.0, 1.0,			
		);

		const proj = shearCam.projectionMatrix;		
		proj.multiply(mShear);
		proj.multiply(mRot);
		shearCam.projectionMatrixInverse.copy(proj).invert(); //1.8
		//shearCam.projectionMatrixInverse.getInverse( proj );

		let total = shearCam.projectionMatrix.elements.reduce( (a, i) => a + i, 0);

		this.fovDelta *= attenuation;
	}
};

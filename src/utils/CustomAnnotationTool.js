
import * as THREE from "../../libs/three.js/build/three.module.js";


// import {Annotation} from "../Annotation.js";
import {Utils} from "../utils.js";
import {CameraMode} from "../defines.js";
import {EventDispatcher} from "../EventDispatcher.js";

export class CustomAnnotation extends THREE.Object3D {
	constructor (args = {}) {
		super();

		this.constructor.counter = (this.constructor.counter === undefined) ? 0 : this.constructor.counter + 1;
		
		this.uuid = THREE.Math.generateUUID();
		
		this._title = args.title || 'Annotation ' + this.constructor.counter;
		this._description = args.description || '';
		
		const readPosition = (position) => {
			if(position == null){
				return new THREE.Vector3(0.0, 0.0, 0.0);
			}else if (position instanceof THREE.Vector3) {
				return position;
			} else {
				return new THREE.Vector3(...position);
			}
		};
		
		this._position = readPosition(args.position);
		this.cameraPosition = readPosition(args.cameraPosition);
		this.cameraTarget = readPosition(args.cameraTarget);
		
		console.log(this._position);
		console.log(this.cameraPosition);
		console.log(this.cameraTarget);
		
		this.points = [];
		this.spheres = [];
		this.edges = [];
	}
	
	createSphereMaterial () {
		let sphereMaterial = new THREE.MeshLambertMaterial({
			//shading: THREE.SmoothShading,
			color: this.color,
			depthTest: false,
			depthWrite: false}
		);

		return sphereMaterial;
	};
	
	addMarker (point) {
		if (point.x != null) {
			point = {position: point};
		}else if(point instanceof Array){
			point = {position: new THREE.Vector3(...point)};
		}
		this.points.push(point);
		
		// sphere
		let sphere = new THREE.Mesh(this.sphereGeometry, this.createSphereMaterial());

		this.add(sphere);
		this.spheres.push(sphere);
		
		{ // Event Listeners
			// let drag = (e) => {
				// let I = Utils.getMousePointCloudIntersection(
					// e.drag.end, 
					// e.viewer.scene.getActiveCamera(), 
					// e.viewer, 
					// e.viewer.scene.pointclouds,
					// {pickClipped: true});

				// if (I) {
					// let i = this.spheres.indexOf(e.drag.object);
					// if (i !== -1) {
						// let point = this.points[i];
						
						////loop through current keys and cleanup ones that will be orphaned
						// for (let key of Object.keys(point)) {
							// if (!I.point[key]) {
								// delete point[key];
							// }
						// }

						// for (let key of Object.keys(I.point).filter(e => e !== 'position')) {
							// point[key] = I.point[key];
						// }

						// this.setPosition(i, I.location);
					// }
				// }
			// };

			// let drop = e => {
				// let i = this.spheres.indexOf(e.drag.object);
				// if (i !== -1) {
					// this.dispatchEvent({
						// 'type': 'marker_dropped',
						// 'measurement': this,
						// 'index': i
					// });
				// }
			// };

			let mouseover = (e) => e.object.material.emissive.setHex(0x888888);
			let mouseleave = (e) => e.object.material.emissive.setHex(0x000000);

			// sphere.addEventListener('drag', drag);
			// sphere.addEventListener('drop', drop);
			sphere.addEventListener('mouseover', mouseover);
			sphere.addEventListener('mouseleave', mouseleave);
		}
		
	}
	
	setPosition (index, position) {
		let point = this.points[index];
		point.position.copy(position);

		// let event = {
			// type: 'marker_moved',
			// measure:	this,
			// index:	index,
			// position: position.clone()
		// };
		// this.dispatchEvent(event);

		this.update();
	};
}

export class CustomAnnotationTool extends EventDispatcher{
	constructor (viewer) {
		super();
		
		this.viewer = viewer;
		this.renderer = viewer.renderer;
		
		this.localScene = new THREE.Scene();
		this.localScene.name = 'scene_annotation';
		this.light = new THREE.PointLight(0xffffff, 1.0);
		this.localScene.add(this.light);
		this.viewer.inputHandler.registerInteractiveScene(this.localScene);
		
		this.onAdd = e => { this.localScene.add(e.annotation); };
		this.onRemove = (e) => { this.localScene.remove(e.annotation); };
		
		viewer.scene.addEventListener('custom_annotation_added', this.onAdd);
		viewer.scene.addEventListener('custom_annotation_removed', this.onRemove);
		
		viewer.addEventListener("update", this.update.bind(this));
		viewer.addEventListener("render.pass.perspective_overlay", this.render.bind(this));
		
		viewer.addEventListener("scene_changed", this.onSceneChange.bind(this));
	}
	
	onSceneChange(e){
		if(e.oldScene){
			e.oldScene.removeEventListener('custom_annotation_added', this.onAdd);
			e.oldScene.removeEventListener('custom_annotation_removed', this.onRemove);
		}

		e.scene.addEventListener('custom_annotation_added', this.onAdd);
		e.scene.addEventListener('custom_annotation_removed', this.onRemove);
	}
	
	startInsertion (args = {}) {
		let domElement = this.viewer.renderer.domElement;
		
		let annotation = new CustomAnnotation({
			cameraPosition: this.viewer.scene.getActiveCamera().position.clone(),
			cameraTarget: this.viewer.scene.view.getPivot().clone()
		});
		
		this.localScene.add(annotation);
		
		let cancel = {
			// removeLastMarker: annotation.maxMarkers > 3,
			callback: null
		};

		let insertionCallback = (e) => {
			if (e.button === THREE.MOUSE.LEFT) {
				annotation.addMarker(annotation.points[annotation.points.length - 1].position.clone());

				this.viewer.inputHandler.startDragging(annotation.spheres[annotation.spheres.length - 1]);
			} else if (e.button === THREE.MOUSE.RIGHT) {
				cancel.callback();
			}
		};
		
		cancel.callback = e => {
			if (cancel.removeLastMarker) {
				annotation.removeMarker(annotation.points.length - 1);
			}
			domElement.removeEventListener('mouseup', insertionCallback, true);
			this.viewer.removeEventListener('cancel_insertions', cancel.callback);
		};
		
		this.viewer.addEventListener('cancel_insertions', cancel.callback);
		domElement.addEventListener('mouseup', insertionCallback, true);
		
		annotation.addMarker(new THREE.Vector3(0, 0, 0));
		this.viewer.inputHandler.startDragging(annotation.spheres[annotation.spheres.length - 1]);
		
		return annotation;
	}
	
	
	
	update() {
		let camera = this.viewer.scene.getActiveCamera();
		let annotations = this.viewer.scene.customAnnotationsList;
		
		const renderAreaSize = this.renderer.getSize(new THREE.Vector2());
		let clientWidth = renderAreaSize.width;
		let clientHeight = renderAreaSize.height;
		
		this.light.position.copy(camera.position);
		
		for(let annotation of annotations) {
			
			
			//Markers scaling
			for(let sphere of annotation.spheres){
				let distance = camera.position.distanceTo(sphere.getWorldPosition(new THREE.Vector3()));
				let pr = Utils.projectedRadius(1, camera, distance, clientWidth, clientHeight);
				let scale = (15 / pr);
				sphere.scale.set(scale, scale, scale);
			}
			
			
		}
	}
	
	render(){
		// console.log("RENDER");
		this.viewer.renderer.render(this.localScene, this.viewer.scene.getActiveCamera());
	}
};

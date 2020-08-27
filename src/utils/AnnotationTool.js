
import {Annotation} from "../Annotation.js";
import {Utils} from "../utils.js";
import {CameraMode} from "../defines.js";
import {EventDispatcher} from "../EventDispatcher.js";

export class AnnotationTool extends EventDispatcher{
	constructor (viewer) {
		super();
		
		this.counter = 0;

		this.viewer = viewer;
		this.renderer = viewer.renderer;

		this.sg = new THREE.SphereGeometry(0.1);
		this.sm = new THREE.MeshNormalMaterial();
		this.s = new THREE.Mesh(this.sg, this.sm);
		
		viewer.addEventListener("update", this.update.bind(this));
	}

	startInsertion (args = {}) {
		let domElement = this.viewer.renderer.domElement;

		let annotation = (args.annotation !== undefined) ? args.annotation : new Annotation({
			position: [0.0, 0.0, 0.0],
			title: "Annotation " + this.counter++,
			description: ``,
			cameraPosition: this.viewer.scene.getActiveCamera().position.clone(),
			cameraTarget: this.viewer.scene.view.getPivot().clone()
		});
		this.dispatchEvent({type: 'start_inserting_annotation', annotation: annotation});

		const annotations = this.viewer.scene.annotations;		
		if(args.annotation === undefined)
			annotations.add(annotation);

		let callbacks = {
			cancel: null,
			finish: null,
		};
	
		let annotationMarker = (args.annotationMarker !== undefined) ? args.annotationMarker : 0;
		let insertionCallback = (e) => {
			if (e.button === THREE.MOUSE.LEFT) {
				if(annotationMarker > 0){
					annotationMarker -= 1;
					annotation.addMarker(annotation.position);
					this.viewer.inputHandler.startDragging(annotation.spheres[annotation.spheres.length - 1]);
				} else {
					callbacks.finish();
				}
			} else if (e.button === THREE.MOUSE.RIGHT && args.annotation === undefined) {
				callbacks.cancel();
			}
		};

		callbacks.cancel = e => {
			annotations.remove(annotation);

			domElement.removeEventListener('mouseup', insertionCallback, true);
		};

		callbacks.finish = e => {
			domElement.removeEventListener('mouseup', insertionCallback, true);
		};

		domElement.addEventListener('mouseup', insertionCallback, true);

		let drag = (e) => {
			let I = Utils.getMousePointCloudIntersection(
				e.drag.end, 
				e.viewer.scene.getActiveCamera(), 
				e.viewer, 
				e.viewer.scene.pointclouds,
				{pickClipped: true});

			if (I) {
				this.s.position.copy(I.location);
				annotation.position.copy(I.location);				
				this.dispatchEvent({ type: 'annotation_position_changed' });
			}
		};

		let drop = (e) => {
			viewer.scene.scene.remove(this.s);
			this.s.removeEventListener("drag", drag);
			this.s.removeEventListener("drop", drop);
		};

		this.s.addEventListener('drag', drag);
		this.s.addEventListener('drop', drop);

		this.viewer.scene.scene.add(this.s);
		this.viewer.inputHandler.startDragging(this.s);

		return annotation;
	}
	
	update(){
		this.viewer.scene.annotations.traverse(annotation => {
			if(annotation.spheres.length > 0) {	
				for(let i = 0 ; i < annotation.spheres.length ; i++) {
					let camera = this.viewer.scene.getActiveCamera();
					const renderAreaSize = this.renderer.getSize(new THREE.Vector2());
					let clientWidth = renderAreaSize.width;
					let clientHeight = renderAreaSize.height;
					
					let sphere = annotation.spheres[i];
					
					let distance = camera.position.distanceTo(sphere.getWorldPosition(new THREE.Vector3()));
					let pr = Utils.projectedRadius(1, camera, distance, clientWidth, clientHeight);
					let scale = (15 / pr);
					
					sphere.scale.set(scale, scale, scale);
					
					sphere.visible = annotation.display && annotation.visible;
					
					let edge = annotation.edges[i];			
					edge.material.resolution.set(clientWidth, clientHeight);
					
					edge.position.copy(sphere.position);				
					edge.geometry.setPositions([
						0, 0, 0,
						...annotation.position.clone().sub(sphere.position).toArray(),
					]);

					edge.geometry.verticesNeedUpdate = true;
					edge.geometry.computeBoundingSphere();
					edge.computeLineDistances();
					
					edge.visible = annotation.display && annotation.visible;
				}
			}
		});
		// let camera = this.viewer.scene.getActiveCamera();
		// let domElement = this.renderer.domElement;
		// let measurements = this.viewer.scene.measurements;

		// const renderAreaSize = this.renderer.getSize(new THREE.Vector2());
		// let clientWidth = renderAreaSize.width;
		// let clientHeight = renderAreaSize.height;

	}

	render(){
		//this.viewer.renderer.render(this.scene, this.viewer.scene.getActiveCamera());
	}
};

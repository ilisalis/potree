
import * as THREE from "../../libs/three.js/build/three.module.js";

import {TextSprite} from "../TextSprite.js";
import {Utils} from "../utils.js";
import {Line2} from "../../libs/three.js/lines/Line2.js";
import {LineGeometry} from "../../libs/three.js/lines/LineGeometry.js";
import {LineMaterial} from "../../libs/three.js/lines/LineMaterial.js";

import {EventDispatcher} from "../EventDispatcher.js";
import {CameraMode} from "../defines.js";

export class MeasureNew extends THREE.Object3D {
	constructor () {
		super();

		this.constructor.counter = (this.constructor.counter === undefined) ? 0 : this.constructor.counter + 1;

		//Measure
		this.name = 'Measure_' + this.constructor.counter;
		this.points = [];
		this.spheres = [];
		this.edges = [];
		
		this._closed = true;
		this._showEdges = true;
		this._showSpheres = true;
		
		this.maxMarkers = Number.MAX_SAFE_INTEGER;
		
		this.sphereGeometry = new THREE.SphereGeometry(0.4, 10, 10);
		this.color = new THREE.Color(0xff0000);


		//Annotation
		this._display = false;
		
		this.descriptionVisible = false;
		this.isHighlighted = false;
		
		this.offset = new THREE.Vector3();
		
		this.domElement = null;
		
		this.annotationPosition = new THREE.Vector3();
		this.cameraPosition = new THREE.Vector3();
		this.cameraTarget = new THREE.Vector3();
		
		this.boundingBox = new THREE.Box3();
		
		this.sphereLabel = new THREE.Mesh(this.sphereGeometry, this.createSphereMaterial());
	}

	get showEdges () {
		return this._showEdges;
	}
	set showEdges (value) {
		this._showEdges = value;
		this.update();
	}	
	get showSpheres () {
		return this._showSpheres;
	}
	set showSpheres (value) {
		this._showSpheres = value;
		this.update();
	}	
	get closed () {
		return this._closed;
	}
	set closed (value) {
		this._closed = value;
		this.update();
	}
	
	createSphereMaterial () {
		let sphereMaterial = new THREE.MeshLambertMaterial({
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

		{ // edges
			let lineGeometry = new LineGeometry();
			lineGeometry.setPositions( [
					0, 0, 0,
					0, 0, 0,
			]);

			let lineMaterial = new LineMaterial({
				color: 0xff0000, 
				linewidth: 2, 
				resolution:  new THREE.Vector2(1000, 1000),
			});

			lineMaterial.depthTest = false;

			let edge = new Line2(lineGeometry, lineMaterial);
			edge.visible = true;

			this.add(edge);
			this.edges.push(edge);
		}

		{ // Event Listeners
			let drag = (e) => {
				let I = Utils.getMousePointCloudIntersection(
					e.drag.end, 
					e.viewer.scene.getActiveCamera(), 
					e.viewer, 
					e.viewer.scene.pointclouds,
					{pickClipped: true});

				if (I) {
					let i = this.spheres.indexOf(e.drag.object);
					if (i !== -1) {
						let point = this.points[i];
						
						// loop through current keys and cleanup ones that will be orphaned
						for (let key of Object.keys(point)) {
							if (!I.point[key]) {
								delete point[key];
							}
						}

						for (let key of Object.keys(I.point).filter(e => e !== 'position')) {
							point[key] = I.point[key];
						}

						this.moveMarker(i, I.location);
					}
				}
			};

			let drop = e => {
				let i = this.spheres.indexOf(e.drag.object);
				if (i !== -1) {
					this.dispatchEvent({
						'type': 'marker_dropped',
						'measurement': this,
						'index': i
					});
				}
			};

			let mouseover = (e) => e.object.material.emissive.setHex(0x888888);
			let mouseleave = (e) => e.object.material.emissive.setHex(0x000000);

			sphere.addEventListener('drag', drag);
			sphere.addEventListener('drop', drop);
			sphere.addEventListener('mouseover', mouseover);
			sphere.addEventListener('mouseleave', mouseleave);
		}

		this.setMarker(this.points.length - 1, point);
		
		let event = {
			type: 'marker_added',
			measurement: this,
			sphere: sphere
		};
		this.dispatchEvent(event);
	};
	removeMarker (index) {
		this.points.splice(index, 1);

		this.remove(this.spheres[index]);

		let edgeIndex = (index === 0) ? 0 : (index - 1);
		this.remove(this.edges[edgeIndex]);
		this.edges.splice(edgeIndex, 1);

		this.spheres.splice(index, 1);

		let event = {
			type: 'marker_removed',
			measurement: this
		};
		this.dispatchEvent(event);
		
		this.update();
	};
	setMarker (index, point) {
		this.points[index] = point;
		
		let event = {
			type: 'marker_moved',
			measure: this,
			index: index,
			position: point.position.clone()
		};
		this.dispatchEvent(event);
		
		this.update();
	}
	moveMarker (index, position) {
		let point = this.points[index];
		point.position.copy(position);

		let event = {
			type: 'marker_moved',
			measure: this,
			index: index,
			position: position.clone()
		};
		this.dispatchEvent(event);

		this.update();
	};

	raycast (raycaster, intersects) {
		for (let i = 0; i < this.points.length; i++) {
			let sphere = this.spheres[i];

			sphere.raycast(raycaster, intersects);
		}

		// recalculate distances because they are not necessarely correct
		// for scaled objects.
		// see https://github.com/mrdoob/three.js/issues/5827
		// TODO: remove this once the bug has been fixed
		for (let i = 0; i < intersects.length; i++) {
			let I = intersects[i];
			I.distance = raycaster.ray.origin.distanceTo(I.point);
		}
		intersects.sort(function (a, b) { return a.distance - b.distance; });
	};
	
	update () {
		if (this.points.length === 0) {
			return;
		}

		let lastIndex = this.points.length - 1;
		for (let i = 0; i <= lastIndex; i++) {
			let index = i;
			let nextIndex = (i + 1 > lastIndex) ? 0 : i + 1;
			let previousIndex = (i === 0) ? lastIndex : i - 1;

			let point = this.points[index];
			let nextPoint = this.points[nextIndex];
			let previousPoint = this.points[previousIndex];

			let sphere = this.spheres[index];

			// spheres
			sphere.position.copy(point.position);
			sphere.material.color = this.color;

			{ // edges
				let edge = this.edges[index];

				edge.material.color = this.color;
				edge.position.copy(point.position);
				edge.geometry.setPositions([
					0, 0, 0,
					...nextPoint.position.clone().sub(point.position).toArray(),
				]);

				edge.geometry.verticesNeedUpdate = true;
				edge.geometry.computeBoundingSphere();
				edge.computeLineDistances();
				edge.visible = index < lastIndex || this.closed;
				
				if(!this.showEdges){
					edge.visible = false;
				}
			}
		}		
	};
	
	
	get display () {
		return this._display;
	}
	set display (display) {
		if (this._display === display) {
			return;
		}

		this._display = display;

		if (display) {
			this.domElement.show();
		} else {
			this.domElement.hide();
		}
	}
	
	addLabel (args = {}) {
		this._title = args.title || 'No Title';
		this._description = args.description || '';
		
		let centroid = new THREE.Vector3();
		let lastIndex = this.points.length - 1;
		for (let i = 0; i <= lastIndex; i++) {
			let point = this.points[i];
			centroid.add(point.position);
		}
		centroid.divideScalar(this.points.length);
		
		
		this.annotationPosition.copy(centroid);
		this.cameraPosition = (args.cameraPosition instanceof Array)
			? new THREE.Vector3().fromArray(args.cameraPosition) : args.cameraPosition;
		this.cameraTarget = (args.cameraTarget instanceof Array)
			? new THREE.Vector3().fromArray(args.cameraTarget) : args.cameraTarget;
		
			
		this.add(this.sphereLabel);		
		this.spheres.push(this.sphereLabel);
		
		this.sphereLabel.position.copy(centroid);
		
		{ // Event Listeners
			let drag = (e) => {
				let I = Utils.getMousePointCloudIntersection(
					e.drag.end, 
					e.viewer.scene.getActiveCamera(), 
					e.viewer, 
					e.viewer.scene.pointclouds,
					{pickClipped: true});

				if (I) {
					
					this.sphereLabel.position.copy(I.location);
					this.annotationPosition.copy(I.location);
				}
			};

			let mouseover = (e) => e.object.material.emissive.setHex(0x888888);
			let mouseleave = (e) => e.object.material.emissive.setHex(0x000000);

			this.sphereLabel.addEventListener('drag', drag);
			this.sphereLabel.addEventListener('mouseover', mouseover);
			this.sphereLabel.addEventListener('mouseleave', mouseleave);
		}
		
		{	
			let iconClose = exports.resourcePath + '/icons/close.svg';
			this.domElement = $(`
				<div class="annotation" oncontextmenu="return false;">
					<div class="annotation-titlebar">
						<span class="annotation-label"></span>
					</div>
					<div class="annotation-description">
						<span class="annotation-description-close">
							<img src="${iconClose}" width="16px">
						</span>
						<span class="annotation-description-content">${this._description}</span>
					</div>
				</div>
			`);
			
			this.elTitlebar = this.domElement.find('.annotation-titlebar');
			this.elTitle = this.elTitlebar.find('.annotation-label');
			this.elTitle.append(this._title);
			this.elDescription = this.domElement.find('.annotation-description');
			this.elDescriptionClose = this.elDescription.find('.annotation-description-close');
			
			this.clickTitle = () => {
				if(this.hasView()){
					this.moveHere(this.scene.getActiveCamera());
				}
				this.dispatchEvent({type: 'click', target: this});
			};
			this.elTitle.click(this.clickTitle);
			
			this.elDescriptionClose.hover(
				e => this.elDescriptionClose.css('opacity', '1'),
				e => this.elDescriptionClose.css('opacity', '0.5')
			);
			this.elDescriptionClose.click(e => this.setHighlighted(false));

			this.domElement.mouseenter(e => this.setHighlighted(true));
			this.domElement.mouseleave(e => this.setHighlighted(false));

			this.domElement.on('touchstart', e => {
				//TODO Considerer le keepOpen ?
				this.setHighlighted(!this.isHighlighted);
			});
			
			this.display = true;
		}
	}
	
	setHighlighted (highlighted) {
		if(this.domElement == null) {
			return;
		}
		
		if (highlighted) {
			this.domElement.css('opacity', '0.8');
			this.elTitlebar.css('box-shadow', '0 0 5px #fff');
			this.domElement.css('z-index', '1000');

			if (this._description) {
				this.descriptionVisible = true;
				this.elDescription.fadeIn(200);
				this.elDescription.css('position', 'relative');
			}
		} else {
			this.domElement.css('opacity', '0.5');
			this.elTitlebar.css('box-shadow', '');
			this.domElement.css('z-index', '100');
			this.descriptionVisible = false;
			this.elDescription.css('display', 'none');
		}

		this.isHighlighted = highlighted;
	}
	
	hasView () {
		let hasPosTargetView = this.cameraTarget instanceof THREE.Vector3;
		hasPosTargetView = hasPosTargetView && this.cameraPosition instanceof THREE.Vector3;

		let hasRadiusView = this.radius !== undefined;

		let hasView = hasPosTargetView || hasRadiusView;

		return hasView;
	};
	
	moveHere (camera) {
		if (!this.hasView()) {
			return;
		}

		let view = this.scene.view;
		let animationDuration = 500;
		let easing = TWEEN.Easing.Quartic.Out;

		let endTarget;
		if (this.cameraTarget) {
			endTarget = this.cameraTarget;
		} else if (this.annotationPosition) {
			endTarget = this.annotationPosition;
		} else {
			endTarget = this.boundingBox.getCenter(new THREE.Vector3());
		}

		if (this.cameraPosition) {
			let endPosition = this.cameraPosition;

			Utils.moveTo(this.scene, endPosition, endTarget);
		} else if (this.radius) {
			let direction = view.direction;
			let endPosition = endTarget.clone().add(direction.multiplyScalar(-this.radius));
			let startRadius = view.radius;
			let endRadius = this.radius;

			{ // animate camera position
				let tween = new TWEEN.Tween(view.position).to(endPosition, animationDuration);
				tween.easing(easing);
				tween.start();
			}

			{ // animate radius
				let t = {x: 0};

				let tween = new TWEEN.Tween(t)
					.to({x: 1}, animationDuration)
					.onUpdate(function () {
						view.radius = this.x * endRadius + (1 - this.x) * startRadius;
					});
				tween.easing(easing);
				tween.start();
			}
		}
	};
	
	updateBounds () {
		let box = new THREE.Box3();

		if (this.annotationPosition) {
			box.expandByPoint(this.annotationPosition);
		}
		
		for (let point of this.points) {
			box.expandByPoint(point);
		}

		//TODO
		/*for (let child of this.children) {
			child.updateBounds();

			box.union(child.boundingBox);
		}*/
		
		this.boundingBox.copy(box);
	}
	
	updateAnnotation (viewer) {
		if(!this.visible || this.domElement == null) {
			return false;
		}
		
		this.updateBounds();
		
		let element = this.domElement;

		let position = this.annotationPosition.clone();
		position.add(this.offset);
		if (!position) { 
			position = this.boundingBox.getCenter(new THREE.Vector3());
		}

		let distance = viewer.scene.cameraP.position.distanceTo(position);
		let radius = this.boundingBox.getBoundingSphere(new THREE.Sphere()).radius;

		let screenPos = new THREE.Vector3();
		let screenSize = 0;

		{
			let renderAreaSize = viewer.renderer.getSize(new THREE.Vector2());
				
			// SCREEN POS
			screenPos.copy(position).project(viewer.scene.getActiveCamera());
			screenPos.x = renderAreaSize.x * (screenPos.x + 1) / 2;
			screenPos.y = renderAreaSize.y * (1 - (screenPos.y + 1) / 2);

			if(!viewer.showOccludedAnnotation){
				let I = Utils.getMousePointCloudIntersection(
					screenPos, 
					viewer.scene.getActiveCamera(), 
					viewer, 
					viewer.scene.pointclouds,
					{pickClipped: true});
				
				if (I) {
					//console.log(I.distance + " ; " + distance);
					if(I.distance < 0.95 * distance) {
						return false; //Non visible
					}
				}
			}

			// SCREEN SIZE
			if(viewer.scene.cameraMode == CameraMode.PERSPECTIVE) {
				let fov = Math.PI * viewer.scene.cameraP.fov / 180;
				let slope = Math.tan(fov / 2.0);
				let projFactor =  0.5 * renderAreaSize.y / (slope * distance);
				screenSize = radius * projFactor;
			} else {
				screenSize = Utils.projectedRadiusOrtho(radius, viewer.scene.cameraO.projectionMatrix, renderAreaSize.x, renderAreaSize.y);
			}
		}

		element.css("left", screenPos.x + "px");
		element.css("top", screenPos.y + "px");
		//element.css("display", "block");

		let zIndex = 10000000 - distance * (10000000 / viewer.scene.cameraP.far);
		if(this.descriptionVisible){
			zIndex += 10000000;
		}
		element.css("z-index", parseInt(zIndex));

		// if(annotation.children.length > 0 && viewer.hierarchyView !== "ALL"){
			// let expand = screenSize > annotation.collapseThreshold || annotation.boundingBox.containsPoint(this.scene.getActiveCamera().position);
			// annotation.expand = expand;
			
			// if (!expand || viewer.hierarchyView === "PARENT") {
				// let inFrustum = (screenPos.z >= -1 && screenPos.z <= 1);
				// if(inFrustum){
					// visibleNow.push(annotation);
				// }
			// }

			// return expand;
		// } else {
			// let inFrustum = (screenPos.z >= -1 && screenPos.z <= 1);
			// if(inFrustum){
				// visibleNow.push(annotation);
			// }
		// }
		
		this.display = (screenPos.z >= -1 && screenPos.z <= 1);
	}
}

export class MeasuringToolNew extends EventDispatcher{
	constructor (viewer) {
		super();

		this.viewer = viewer;
		this.renderer = viewer.renderer;

		this.addEventListener('start_inserting_measurement', e => {
			console.log("start_inserting_measurement");
			this.viewer.dispatchEvent({
				type: 'cancel_insertions'
			});
		});

		this.showLabels = true;
		this.scene = new THREE.Scene();
		this.scene.name = 'scene_measurement';
		this.light = new THREE.PointLight(0xffffff, 1.0);
		this.scene.add(this.light);

		this.viewer.inputHandler.registerInteractiveScene(this.scene);

		this.onRemove = (e) => { this.scene.remove(e.measurement);};
		this.onAdd = e => {this.scene.add(e.measurement);};

		// for(let measurement of viewer.scene.measurements){
			// this.onAdd({measurement: measurement});
		// }

		viewer.addEventListener("update", this.update.bind(this));
		viewer.addEventListener("render.pass.perspective_overlay", this.render.bind(this));
		viewer.addEventListener("scene_changed", this.onSceneChange.bind(this));

		// viewer.scene.addEventListener('new_annotation_added', this.onAdd);
		viewer.scene.addEventListener('measurement_removed', this.onRemove);
	}

	onSceneChange(e){
		if(e.oldScene){
			e.oldScene.removeEventListener('new_annotation_added', this.onAdd);
			e.oldScene.removeEventListener('measurement_removed', this.onRemove);
		}

		e.scene.addEventListener('new_annotation_added', this.onAdd);
		e.scene.addEventListener('measurement_removed', this.onRemove);
	}

	startInsertion (args = {}) {
		let domElement = this.viewer.renderer.domElement;

		let measure = new MeasureNew();

		this.dispatchEvent({
			type: 'start_inserting_measurement',
			measure: measure
		});

		const pick = (defaul, alternative) => {
			if(defaul != null){
				return defaul;
			}else{
				return alternative;
			}
		};
		
		measure.closed = false;
		measure.maxMarkers = pick(args.maxMarkers, Infinity);
		measure.name = args.name || 'Custom Annotation';

		this.scene.add(measure);

		let cancel = {
			removeLastMarker: measure.maxMarkers > 3,
			callback: null
		};

		let insertionCallback = (e) => {
			if (e.button === THREE.MOUSE.LEFT) {
				measure.addMarker(measure.points[measure.points.length - 1].position.clone());

				if (measure.points.length >= measure.maxMarkers) {
					cancel.callback();
				}

				this.viewer.inputHandler.startDragging(
					measure.spheres[measure.spheres.length - 1]);
			} else if (e.button === THREE.MOUSE.RIGHT) {
				cancel.callback();
			}
		};
		
		//TODO changer le nom de la fonction
		let insertionCallbackSecondStep = (e) => {
			if (e.button === THREE.MOUSE.RIGHT && e.detail === 2) {
				measure.showSpheres = false;
				
				domElement.removeEventListener('mouseup', insertionCallbackSecondStep, true);
			}
		}
		
		//TODO delete si moins de 3 points definis

		cancel.callback = e => {
			if (cancel.removeLastMarker) {
				measure.removeMarker(measure.points.length - 1);
			}
			measure.closed = true;
			
			measure.addLabel({
				cameraPosition: this.viewer.scene.getActiveCamera().position.clone(),
				cameraTarget: this.viewer.scene.view.getPivot().clone()
			});
			
			this.dispatchEvent({
				'type': 'custom_annotation_added',
				'annotation': measure
			});
			
			domElement.removeEventListener('mouseup', insertionCallback, true);
			this.viewer.removeEventListener('cancel_insertions', cancel.callback);
			
			domElement.addEventListener('mouseup', insertionCallbackSecondStep, true);
		};

		if (measure.maxMarkers > 1) {
			this.viewer.addEventListener('cancel_insertions', cancel.callback);
			domElement.addEventListener('mouseup', insertionCallback, true);
		}

		measure.addMarker(new THREE.Vector3(0, 0, 0));
		this.viewer.inputHandler.startDragging(
			measure.spheres[measure.spheres.length - 1]);

		this.viewer.scene.addNewAnnotation(measure)
		
		return measure;
	}
	
	update(){
		let camera = this.viewer.scene.getActiveCamera();
		let domElement = this.renderer.domElement;
		let measurements = this.viewer.scene.customAnnotationsList;

		const renderAreaSize = this.renderer.getSize(new THREE.Vector2());
		let clientWidth = renderAreaSize.width;
		let clientHeight = renderAreaSize.height;

		this.light.position.copy(camera.position);

		// make size independant of distance
		for (let measure of measurements) {
			measure.lengthUnit = this.viewer.lengthUnit;
			measure.lengthUnitDisplay = this.viewer.lengthUnitDisplay;
			measure.update();

			// spheres
			for(let sphere of measure.spheres){
				let distance = camera.position.distanceTo(sphere.getWorldPosition(new THREE.Vector3()));
				let pr = Utils.projectedRadius(1, camera, distance, clientWidth, clientHeight);
				let scale = (15 / pr);
				sphere.scale.set(scale, scale, scale);
				
				sphere.visible = measure.showSpheres;
				// sphere.material.color = new THREE.Color(0x00ff00);
			}
			
			/*let distance = camera.position.distanceTo(measure.s.getWorldPosition(new THREE.Vector3()));
			let pr = Utils.projectedRadius(1, camera, distance, clientWidth, clientHeight);
			let scale = (15 / pr);
			measure.s.scale.set(scale, scale, scale);
			
			measure.s.visible = measure.showSpheres;*/
		}
	}

	render(){
		this.viewer.renderer.render(this.scene, this.viewer.scene.getActiveCamera());
	}
};

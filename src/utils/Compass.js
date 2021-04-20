
import * as THREE from "../../libs/three.js/build/three.module.js";

import {Utils} from "../utils.js";

export class Compass{

	constructor(viewer){
		this.viewer = viewer;

		this.visible = false;
		this.dom = this.createElement();

		viewer.addEventListener("update", () => {
			if(this.visible){
				const direction = viewer.scene.view.direction.clone();
				direction.z = 0;
				direction.normalize();
				
				let azimuth = 0;
				if(direction.x === 0 && direction.y === 0) {
					azimuth = viewer.scene.view.yaw;
				} else {
					const camera = viewer.scene.getActiveCamera();

					const p1 = camera.getWorldPosition(new THREE.Vector3());
					const p2 = p1.clone().add(direction);
					const projection = viewer.getProjection();
					azimuth = Utils.computeAzimuth(p1, p2, projection);
				}
				
				this.dom.css("transform", `rotateZ(${-azimuth}rad)`);
			}
		});

		this.dom.click( () => {
			viewer.setTopView();
		});

		const renderArea = $(viewer.renderArea);
		renderArea.append(this.dom);

		this.setVisible(this.visible);
	}

	setVisible(visible){
		this.visible = visible;

		const value = visible ? "" : "none";
		this.dom.css("display", value);
	}

	isVisible(){
		return this.visible;
	}

	createElement(){
		const style = `style="position: absolute; bottom: 10px; right: 10px; z-index: 10000; width: 64px;"`;
		const img = $(`<img src="${Potree.resourcePath}/images/compas.svg" ${style} />`);

		return img;
	}

};
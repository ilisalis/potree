
import {Utils} from "../utils.js";

export class Scalebar{

	constructor(viewer){
		this.viewer = viewer;

		this.visible = false;
		const defaultSize = 400;
		const defaultValue = 5;
		
		this.domElement = $(`
			<div style="position: absolute; text-align: center; right: 84px; top: 26px;">
				<img id="scalebar_image" src="${Potree.resourcePath}/images/scalebar.svg" style="height: 32px; width: ${defaultSize}px; transform-origin: 100% 50%;">
				<div id="scalebar_value" style="position: absolute; color: black; font-weight: bold; top: 45%; right: 0%; transform: translate(-20%, -50%);"></div>
			</div>
		`);
		
		const scalebarImg = this.domElement.find(`#scalebar_image`);
		const scalebarText = this.domElement.find(`#scalebar_value`);
	
		viewer.addEventListener("update", () => {
			if(this.visible){
				let camera = viewer.scene.getActiveCamera();
				
				if(!(camera instanceof THREE.OrthographicCamera)){
					this.viewer.scalebar.setVisible(false);
					return;
				}
				
				const dir = this.viewer.scene.view.direction.clone();
				dir.normalize();
				
				const p0 = this.viewer.scene.view.getPivot();
				const d = -(dir.x * p0.x + dir.y * p0.y + dir.z * p0.z);
				
				const p1 = p0.clone().add(new THREE.Vector3(1.0 - Math.abs(dir.x), 1.0 - Math.abs(dir.y), 1.0 - Math.abs(dir.z)));
				
				if(Math.abs(dir.x) < 0.99999 && Math.abs(dir.y) < 0.99999 && Math.abs(dir.z) < 0.99999){
					if(Math.abs(dir.x) > 0.00001){
						p1.x = -(d + dir.z * p1.z + dir.y * p1.y) / dir.x;
					} else if(Math.abs(dir.y) > 0.00001){
						p1.y = -(d + dir.x * p1.x + dir.z * p1.z) / dir.y;
					} else if(Math.abs(dir.z) > 0.00001){
						p1.z = -(d + dir.x * p1.x + dir.y * p1.y) / dir.z;
					}
				}
				
				const {width, height} = viewer.renderer.getSize(new THREE.Vector2());
				
				let projected0 = p0.clone().project(camera);				
				let projected1 = p1.clone().project(camera);
				
				const proj0 = new THREE.Vector2(width * (projected0.x * 0.5 + 0.5), height - height * (projected0.y * 0.5 + 0.5));
				const proj1 = new THREE.Vector2(width * (projected1.x * 0.5 + 0.5), height - height * (projected1.y * 0.5 + 0.5));
				
				let scale = (5.0 / defaultSize) * proj0.distanceTo(proj1) / p0.distanceTo(p1);
				let value = defaultValue;
				
				let suffix = "";
				let unitConversion = 1.0;
				if(this.viewer.lengthUnit != null && this.viewer.lengthUnitDisplay != null){
					unitConversion *= this.viewer.lengthUnit.unitspermeter / this.viewer.lengthUnitDisplay.unitspermeter;
					suffix = this.viewer.lengthUnitDisplay.code;
				}				
				scale *= unitConversion;
				
				if(Math.floor(1.0 / scale) > 1) {
					let rescaling = Math.floor(1.0 / scale);					
					scale *= rescaling;
					value *= rescaling;
				} else if (Math.floor(scale) > 1) {
					
					let rescaling = Math.floor(scale);
					let pow = 0.0;

					while(rescaling >= 10.0){
						pow += 1.0;
						rescaling /= 10.0;
					}
					
					if(rescaling >= 5) {
						scale /= 5 * Math.pow(10, pow);
						value /= 5 * Math.pow(10, pow);
					} else if(rescaling >= 2) {
						scale /= 2 * Math.pow(10, pow);
						value /= 2 * Math.pow(10, pow);
					} else if(pow >= 1){
						scale /= Math.pow(10, pow);
						value /= Math.pow(10, pow);						
					}					
				}
				
				scalebarImg.css("transform", `scaleX(${scale})`);
				scalebarText.html(`${value} ${suffix}`);
			}
		});

		const renderArea = $(viewer.renderArea);
		renderArea.append(this.domElement);

		this.setVisible(this.visible);
	}

	setVisible(visible){
		this.visible = visible;

		const value = visible ? "" : "none";
		this.domElement.css("display", value);
	}

	isVisible(){
		return this.visible;
	}
};
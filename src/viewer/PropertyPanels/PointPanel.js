

import {MeasurePanel} from "./MeasurePanel.js";

export class PointPanel extends MeasurePanel{
	constructor(viewer, measurement, propertiesPanel){
		super(viewer, measurement, propertiesPanel);
		
		let removeIconPath = Potree.resourcePath + '/icons/remove.svg';
		this.elContent = $(`
			<div class="measurement_content selectable">
				<span class="coordinates_table_container"></span>
				<br>
				<span class="attributes_table_container"></span>

				<!-- ACTIONS -->
				<div style="display: flex; margin-top: 12px">
					<span></span>
					<span style="flex-grow: 1"></span>
					<img name="remove" data-i18n="[title]scene.button_remove" class="button-icon" src="${removeIconPath}" style="width: 16px; height: 16px"/>
				</div>
			</div>
		`);

		this.elRemove = this.elContent.find("img[name=remove]");
		this.elRemove.click( () => {
			this.viewer.scene.removeMeasurement(measurement);
		});

		this.propertiesPanel.addVolatileListener(measurement, "marker_added", this._update);
		this.propertiesPanel.addVolatileListener(measurement, "marker_removed", this._update);
		this.propertiesPanel.addVolatileListener(measurement, "marker_moved", this._update);

		this.update();
	}

	update(){
		let elCoordiantesContainer = this.elContent.find('.coordinates_table_container');
		elCoordiantesContainer.empty();
		elCoordiantesContainer.append(this.createCoordinatesTable(this.measurement.points.map(p => p.position)));
		
		proj4.defs("WGS84", "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs");
		proj4.defs("pointcloud", this.viewer.getProjection());
		
		var fromModel = proj4.defs("pointcloud");
		var toWGS84 = proj4.defs("WGS84");
		
		var coordinate = proj4(fromModel, toWGS84, [this.measurement.points[0].position.x, this.measurement.points[0].position.y]);
		console.log(coordinate);

		let elAttributesContainer = this.elContent.find('.attributes_table_container');
		elAttributesContainer.empty();
		elAttributesContainer.append(this.createAttributesTable());
		
		this.elContent.i18n();
	}
};
//var pointcloudPath = "../resources/pointclouds/sorvilier/cloud.js";
	var pointcloudPath = "http://potree.org/resources/pointclouds/sigeom/vol_total_bin/cloud.js";
	var defaultPointSize = 1.3;
	var defaultLOD = 12;
	
	// add EPSG:21781 to the proj4 projection database
	proj4.defs('EPSG:21781', "+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.4,15.1,405.3,0,0,0,0 +units=m +no_defs ");
	var fromSwiss = proj4.defs("EPSG:21781");
	var toWGS84 = proj4.defs("WGS84");
	
	// extent (with altitude) in EPSG:21781 / Swiss Coordinate System
	var minSwiss = [584757.154, 230878.747, 662.379];
	var maxSwiss = [593758.872, 232521.598, 850.323];
	
	// extent in EPSG:4326 / WGS84 World Geodetic System
	var minExtent = proj4(proj4.defs("EPSG:21781"), proj4.defs("WGS84"), [minSwiss[0], minSwiss[1]]);
	var maxExtent = proj4(proj4.defs("EPSG:21781"), proj4.defs("WGS84"), [maxSwiss[0], maxSwiss[1]]);
	
	// extent in EPSG:3857 / WGS84 Web Mercator 
	var minT = ol.proj.transform(minExtent, 'EPSG:4326', 'EPSG:3857');
	var maxT = ol.proj.transform(maxExtent, 'EPSG:4326', 'EPSG:3857');
	
	// the offset of the point cloud in EPSG:21781 coordinate system to local scene coordinates.
	// subtract this offset in order to move from local scene coordinates (obtained from picking, etc.) 
	// to EPSG:21781 coordinates
	var offset = new THREE.Vector3();

	
	// OpenLayers3 stuff
	var featureVector;
	var camFrustumFeatureVector;
	var camFrustum;
	
	// three.js / potree stuff
	var renderer;
	var scene;
	var camera;
	var skybox;
	var materials = {};
	var clock = new THREE.Clock();
	var measuringTool;
	
	function initMapView(){
		
		var extent = [minT[0], minT[1], maxT[0], maxT[1]];
		var center = [(maxT[0] + minT[0]) / 2, (maxT[1] + minT[1]) / 2];
		
		// draw the extent as box inside the map view
		var box = new ol.geom.LineString([
			minT, [maxT[0], minT[1]], maxT, [minT[0], maxT[1]], minT
		]);
		
		var feature = new ol.Feature(box);
		featureVector = new ol.source.Vector({
			features: [feature]
		});
		
		var layer = new ol.layer.Vector({
			source: featureVector,
			style: new ol.style.Style({
			fill: new ol.style.Fill({
			  color: 'rgba(255, 255, 255, 0.2)'
			}),
			stroke: new ol.style.Stroke({
			  color: '#ff0000',
			  width: 2
			}),
			image: new ol.style.Circle({
			  radius: 3,
			  fill: new ol.style.Fill({
				color: '#0000ff'
			  })
			})
		  })
		});	
		
		camFrustumFeatureVector = new ol.source.Vector({
			features: []
		});

		var camFrustumLayer = new ol.layer.Vector({
			source: camFrustumFeatureVector,
			style: new ol.style.Style({
			fill: new ol.style.Fill({
			  color: 'rgba(255, 255, 255, 0.2)'
			}),
			stroke: new ol.style.Stroke({
			  color: '#ff0000',
			  width: 2
			}),
			image: new ol.style.Circle({
			  radius: 3,
			  fill: new ol.style.Fill({
				color: '#ff0000'
			  })
			})
		  })
		});	
		
		// create the map
		var map = new ol.Map({
			controls: ol.control.defaults({
				attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
				collapsible: false
				})
			}).extend([
				new ol.control.ZoomToExtent({
					extent: extent,
					closest: true
				})
			]),
			layers: [
				new ol.layer.Tile({
					source: new ol.source.OSM()
				}),
				layer,
				camFrustumLayer
			],
			target: 'map',
			view: new ol.View({
				center: center,
				zoom: 12
			})
		});
	}
	
	function initPotreeView(){
		var renderArea = document.getElementById("renderArea");
		var near = 0.1;
		var far = 100000;
		var fov = 60;
		
		var aspect = renderArea.clientWidth / renderArea.clientHeight;
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
		
		renderer = new THREE.WebGLRenderer();
		renderer.setSize(renderArea.clientWidth, renderArea.clientHeight);
		renderer.autoClear = false;
		renderArea.appendChild(renderer.domElement);
		
		skybox = Potree.utils.loadSkybox("../resources/textures/skybox/");
		
		camera.position.set(5050, 158, -600);
		controls = new THREE.FirstPersonControls(camera, renderer.domElement);
		camera.rotation.order = 'ZYX';
		camera.rotation.x = -0.5;
		camera.rotation.y = -3*Math.PI/4;
		controls.moveSpeed *= 10;
		
		materials.rgb = new Potree.PointCloudRGBMaterial({ size: defaultPointSize});
		
		// load pointcloud
		var pco = POCLoader.load(pointcloudPath, {toOrigin: true});
		offset = pco.offset;
		pointcloud = new Potree.PointCloudOctree(pco, materials.rgb);
		pointcloud.LOD = defaultLOD;
		pointcloud.applyMatrix(new THREE.Matrix4().set(
			1,0,0,0,
			0,0,1,0,
			0,-1,0,0,
			0,0,0,1
		));
		scene.add(pointcloud);
		
		measuringTool = new Potree.MeasuringTool(scene, camera, renderer.domElement);
		
		// execute this event whenever a new measurement point has been set
		measuringTool.addEventListener("newpoint", function(event){
			// transform from local scene to swiss projection. 
			var point = new THREE.Vector3(event.position.x, -event.position.z, event.position.y);
			point = point.sub(offset);
			
			// transform from swiss projection to WGS84
			var fromSwiss = proj4.defs("EPSG:21781");
			var toWGS84 = proj4.defs("WGS84");
			var coordinate = proj4(fromSwiss, toWGS84, [point.x, point.y]);
			
			// transform from WGS84 to Web Mercator
			coordinate = ol.proj.transform(coordinate, 'EPSG:4326', 'EPSG:3857');
	
			// add a point to the OpenLayers map
			var olPoint = new ol.geom.Point(coordinate);
			var feature = new ol.Feature(olPoint);
			featureVector.addFeature(feature);
		});
	}
	
	function initGUI(){
	
		// dat.gui
		var gui = new dat.GUI({
			height : 5 * 32 - 1
		});
		
		var params = {
			PointSize: defaultPointSize,
			LOD: defaultLOD,
			"bounding box" : false
		};
		
		var pLOD = gui.add(params, 'LOD', 0.5,20);
		pLOD.onChange(function(value){
			pointcloud.LOD = value;
		});
		
		var pPointSize = gui.add(params, 'PointSize', 0.01, 2.0);
		pPointSize.onChange(function(value){
			pointcloud.material.size = value;
		});
		
		var pBoundingBox = gui.add(params, 'bounding box');
		pBoundingBox.onChange(function(value){
			pointcloud.showBoundingBox = value;
		});
		
	}
	
	function update(){
		controls.update(clock.getDelta());
		pointcloud.update(camera);
	
		if(camFrustum === undefined){
			camFrustum = new ol.geom.LineString([ [0,0], [0, 0] ]);
			var feature = new ol.Feature(camFrustum);
			camFrustumFeatureVector.addFeature(feature);
		}
		
		
		var aspect = camera.aspect;
		var top = Math.tan( THREE.Math.degToRad( camera.fov * 0.5 ) ) * camera.near;
		var bottom = - top;
		var left = aspect * bottom;
		var right = aspect * top;
		
		var camPos = new THREE.Vector3(0, 0, 0);
		left = new THREE.Vector3(left, 0, -camera.near).multiplyScalar(3000);
		right = new THREE.Vector3(right, 0, -camera.near).multiplyScalar(3000);
		camPos.applyMatrix4(camera.matrixWorld);
		left.applyMatrix4(camera.matrixWorld);
		right.applyMatrix4(camera.matrixWorld);
		
		
		// transform from local scene to swiss projection. 
		camPos = new THREE.Vector3(camPos.x, -camPos.z, camPos.y).sub(offset);
		left = new THREE.Vector3(left.x, -left.z, left.y).sub(offset);
		right = new THREE.Vector3(right.x, -right.z, right.y).sub(offset);
		
		camPos = proj4(fromSwiss, toWGS84, [camPos.x, camPos.y]);
		left = proj4(fromSwiss, toWGS84, [left.x, left.y]);
		right = proj4(fromSwiss, toWGS84, [right.x, right.y]);
		
		camPos = ol.proj.transform(camPos, 'EPSG:4326', 'EPSG:3857');
		left = ol.proj.transform(left, 'EPSG:4326', 'EPSG:3857');
		right = ol.proj.transform(right, 'EPSG:4326', 'EPSG:3857');
		
		camFrustum.setCoordinates([camPos, left, right, camPos]);
	}
	
	function render(){
		// resize 
		var renderArea = document.getElementById("renderArea");
		var width = renderArea.clientWidth;
		var height = renderArea.clientHeight;
		
		renderer.setSize(width, height-10);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();

		// render skybox
		skybox.camera.rotation.copy(camera.rotation);
		renderer.render(skybox.scene, skybox.camera);
		
		// render scenes
		renderer.render(scene, camera);
		renderer.render(measuringTool.sceneMeasurement, camera);
		
	}
	
	function loop(){
		requestAnimationFrame(loop);
	
		update();
		render();
	}
	
	initMapView();
	initPotreeView();
	initGUI();
	loop();
// Easy3D_WebGL
// Main demo program for version 0.5
// Demonstrate various basic shaders
// Emmanuel Charette 2020

"use strict"


function E3D_userInit() {
    var programs = [];
    var meshLoader = new E3D_loader();

    log("E3D_userInit");

    // Load all default engine parts: scene, lights, timer, inputs, camera
    E3D_InitAll();


    // Change the scene back to basic
    SCENE = new E3D_scene("scene1", _v3_black);

    // Load the shaders
    log("Shader Program 1 ", false);
    programs[0] = new E3D_program("program_base_passtrough", programData_passtrough);
    log("Shader Program 2 ", false);
    programs[1] = new E3D_program("program_base_normals", programData_passtrough_shownormals);
    log("Shader Program 3 ", false);
    programs[2] = new E3D_program("program_base_depth", programData_passtrough_showdepth);
    log("Shader Program 4 ", false);
    programs[3] = new E3D_program("program_base_shade", programData_passtrough_shade);
    log("Shader Program 5 ", false);
    programs[4] = new E3D_program("program_base_shadeAndDepth", programData_passtrough_shadeAndDepth);


    // Set the scene
    SCENE.program = programs[0];
    SCENE.initialize();
    SCENE.state = E3D_ACTIVE;


    // Move the camera back and up a little, add some nod 
    CAMERA.moveTo(0, 100, 100, 0.5);




    // Create the entities
    var groundEntity = new E3D_entity_wireframe_canvas("entity0");
    // Large ground plane
    groundEntity.addPlane(_v3_origin, _v3_90x, 2048, 2048, 128, _v3_lightgray);
    groundEntity.isVisible = true;
    E3D_addEntity(groundEntity);


    // Create a solid cube
    meshLoader.pushBox(48, 48, 48);     
    // Randomize colors
    for (var i = 0; i < meshLoader.colors.length; ++i) meshLoader.colors[i] = Math.random();


    // Create a few more cubes spread around
    for (var x = -2; x < 2; ++x) for (var y = -2; y < 2; ++y) {

        var newEnt = new E3D_entity("cube" + x + "-" + y);
        meshLoader.addModelData(newEnt);
        newEnt.isVisible = true;

        // Set positions, randomize rotation
        newEnt.position = [x * 150 + 75, 24, y * 150 + 75];
        newEnt.rotation = [rndPM(Math.PI), rndPM(Math.PI), 0];

        E3D_addEntity(newEnt);
    }


    
    // Create a torus mesh
    var torusEntity = new E3D_entity("torus", "", false);
    meshLoader.reset();
    meshLoader.pushTorus(32, 12, 31, 16);

    // Randomize colors
    for (var i = 0; i < meshLoader.colors.length; ++i) meshLoader.colors[i] = Math.random();

    // Check and smooth adjascent normals if they are similar
    meshLoader.smoothNormals(0.7);
    meshLoader.addModelData(torusEntity);
    torusEntity.isVisible = true;
    torusEntity.position = [0, 24, 0];
    E3D_addEntity(torusEntity);




    // Register the button events
    var btn = document.getElementById("btn_s1");
    if (btn) btn.addEventListener("click", x => SCENE.program = programs[0] );
    var btn = document.getElementById("btn_s2");
    if (btn) btn.addEventListener("click", x => SCENE.program = programs[1] );
    var btn = document.getElementById("btn_s3");
    if (btn) btn.addEventListener("click", x => SCENE.program = programs[2] );
    var btn = document.getElementById("btn_s4");
    if (btn) btn.addEventListener("click", x => SCENE.program = programs[3] );
    var btn = document.getElementById("btn_s5");
    if (btn) btn.addEventListener("click", x => SCENE.program = programs[4] );



    // use the engine OnTick event callback to change the rotation of the torus
    CB_tick = function() {
        // rotate around Y
        torusEntity.rotation[1] += TIMER.delta * 0.33;
        torusEntity.updateMatrix();
    }


}

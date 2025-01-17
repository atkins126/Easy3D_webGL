// Easy3D_WebGL
// State container for animations
// Emmanuel Charette 2017-2019

"use strict"



/**
 * Animation class
 * 
 * @param {String} id Animation identifier
 * @param {E3D_scene} sceneContext Rendering Scene
 * @param {E3D_timer} timerclass Timer object
 * @param {function} animFirstPass Delegate function for calculating single or ideal animation results
 * @param {function} animNPass Delegate function to recalculate animation result based on collision detections
 * @param {function} animLastPass Delegate function to commit animation results or to post-process
 */
class E3D_animation {  // TODO merge with entity
    constructor(id, targetEntity, animFirstPass, collResolver_asSource = null, collResolver_asTarget = null, animLastPass =  null, group = 0) {

        this.id = id;
        
        this.animFirstPass = animFirstPass; //  calculate ideal next position
        this.sourceCollResolver = collResolver_asSource;
        this.targetCollResolver = collResolver_asTarget;
        this.animLastPass = animLastPass; // commit final state after collision detections are completed or prep next pass

        this.target = targetEntity;
        this.group = group;
        
        this.ttl = 0; // -1 to disable
        this.state = E3D_RESET;
        this.endState = E3D_DONE; // once ttl reached 0

        // Custom data
        this.last_position = v3_new();
        
        // Tranforms
        this.pspd = v3_new();
        this.rspd = v3_new();
        this.gravity = 0.0;
        this.frameG = 0.0;

        // Particules
        this.pNum = 10;
        this.pActive = [];
        this.pLastPos = [];
        this.pPos = [];
        this.pSpd = [];
        this.pSpdLength = [];
        this.pCD = false;

        // For Collision Detection
        this.delta = [0, 0, 0]; // Position delta
        this.deltaLength = -1; // length of this.delta during animation step for culling, -1 anim target is not a source

        this.colNumStart = 3;
        this.collisionDetected = false;
        this.colNum = 0;
        this.closestCollision = new Array(this.colNumStart);
        for (var i = 0; i < this.colNumStart; ++i) this.closestCollision[i] = new CDresult(); 

        this.collisionFromOther = false;
        this.otherColNum = 0;
        this.otherCollision = new Array(this.colNumStart);
        for (var i = 0; i < this.colNumStart; ++i) this.otherCollision[i] = new CDresult(); 


        this.candidates = []; // for all other entities, bool to test for CD after culling pass
        this.lastHitMarker = ""; // marker of last hit target to ignore on next pass
    }

    animateFirstPass(x) {
        if (this.animFirstPass) {
            this.animFirstPass(x);
        }
    }

    animateResolvePass(x) {
        if (this.collisionDetected && this.collisionFromOther) { 
            if (this.sourceCollResolver && this.targetCollResolver) {
                if (this.closestCollision.t0 < this.otherCollision.t0) {
                    this.sourceCollResolver(x);
                } else {
                    this.targetCollResolver(x);
                }
            } else if (this.sourceCollResolver) {
                this.sourceCollResolver(x);
            } else if (this.targetCollResolver) {
                this.targetCollResolver(x);
            }
        } else if (this.collisionDetected && this.sourceCollResolver) {
            this.sourceCollResolver(x);
        } else if (this.collisionFromOther && this.targetCollResolver) {
            this.targetCollResolver(x);
        }
        
        this.collisionDetected = false;
        this.collisionFromOther = false;
    }

    animateLastPass(x) {
        if (this.animLastPass) {
            this.animLastPass(x);
        }
    }

    reset() {
        this.state = E3D_RESET;        
    }
    play() {
        this.state = E3D_PLAY;  
    }
    pause() {
        this.state = E3D_PAUSE;  
    }
    restart(x) {
        this.startObject = x;
        this.state = E3D_RESTART;  
    }
    done() {
        this.state = E3D_DONE;  
    }


    resetCollisions() {             
        for (var i = 0; i < this.colNum; ++i) this.closestCollision[i].reset();
        for (var i = 0; i < this.otherColNum; ++i) this.otherCollision[i].reset();

        this.collisionDetected = false;
        this.collisionFromOther = false;

        this.colNum = 0;
        this.otherColNum = 0;
        //this.lastHitMarker = "";
    }

    pushCollisionSource(m, t, n, p, sDesc, scdi, tei, tDesc, tcdi) {
        if (this.colNum >= this.closestCollision.length) this.closestCollision.push(new CDresult());
        
        this.closestCollision[this.colNum].marker = ""+m;
        this.closestCollision[this.colNum].t0 = t;
        v3_copy(this.closestCollision[this.colNum].n, n);
        v3_copy(this.closestCollision[this.colNum].p0, p);
        
        this.closestCollision[this.colNum].source_desc = sDesc;
        this.closestCollision[this.colNum].source_cdi = scdi;
        this.closestCollision[this.colNum].target_ei = tei;
        this.closestCollision[this.colNum].target_desc = tDesc;
        this.closestCollision[this.colNum].target_cdi = tcdi; 
        
        this.colNum++;
        this.collisionDetected = true;
    }



    pushCollisionTarget(m, t, n, p, sDesc, scdi, tei, tDesc, tcdi, s) {
        if (this.otherColNum >= this.otherCollision.length) this.otherCollision.push(new CDresult());
       
        this.otherCollision[this.otherColNum].marker = ""+m;
        this.otherCollision[this.otherColNum].t0 = t;
        v3_copy(this.otherCollision[this.otherColNum].n, n);
        v3_copy(this.otherCollision[this.otherColNum].p0, p);
        
        this.otherCollision[this.otherColNum].source_desc = sDesc;
        this.otherCollision[this.otherColNum].source_cdi = scdi;
        this.otherCollision[this.otherColNum].target_ei = tei;
        this.otherCollision[this.otherColNum].target_desc = tDesc;
        this.otherCollision[this.otherColNum].target_cdi = tcdi; 
        
        v3_copy(this.otherCollision[this.otherColNum].s, s);

        this.otherColNum++;
        this.collisionFromOther = true;

    }


}



// Animator methods



function singlePassAnimator(animList /*, animGroup*/) {
    for (let i = 0; i < animList.length; ++i) animList[i].animateFirstPass();
}

function multiPassAnimator(animList /*, animGroup*/) {
    for (let i = 0; i < animList.length; ++i) animList[i].animateFirstPass();
    for (let i = 0; i < animList.length; ++i) animList[i].animateResolvePass();
    for (let i = 0; i < animList.length; ++i) animList[i].animateLastPass();
}

function collisionDetectionAnimator(animList, scn, /*animGroup, */ maxCDIterations = 10) {
    // Animate / Calculate Expected target position and state

    // First pass, calculate expected next position
    for (let i = 0; i < animList.length; ++i) {
        animList[i].animateFirstPass();
        animList[i].resetCollisions();
    } 

    // calc distance every time top 100% of 0.050s at 800 entities 
    // map with distance and hash of ID 100 at 200 entities
    // list in animation target entity at 700
    //  list in both and map to lookup at 600
    //  multi pass, only add if closest max at 600

    // Cull Collission Detection
    for (let i = 0; i < animList.length; ++i) // CD culling
    if ((animList[i].target.collisionDetection) && (animList[i].deltaLength > -1)) { 

        animList[i].candidates = new Array(scn.entities.length);
        for (let j = 0; j < scn.entities.length; ++j) {// all entities are targets
            animList[i].candidates[j] = false;
            if ((scn.entities[j].collisionDetection == true) && (animList[i].target.id != scn.entities[j].id) ) { 
                var deltaP = v3_distance( animList[i].target.position, scn.entities[j].position); // TODO cache in entity
                var deltaD = animList[i].deltaLength + animList[i].target.cull_dist + scn.entities[j].cull_dist; // TODO add other ent deltaLength
                animList[i].candidates[j] = deltaP <= deltaD;  
            }
        }

    }

    var numIter = maxCDIterations;
    var hitDetected = true;

    while ((numIter > 0) && (hitDetected)){

        // Collision Detection
        hitDetected = false;
        for (let i = 0; i < animList.length; ++i) if ((animList[i].target.collisionDetection) && (animList[i].deltaLength > 0.0)) {
            if (animList[i].target.CD_sph > 0) CheckForAnimationCollisions_SphSource(animList[i], scn, animList);
            if (animList[i].target.CD_point > 0) CheckForAnimationCollisions_PointSource(animList[i], scn, animList);
        }
        
        // Collision Response
        for (let i = 0; i < animList.length; ++i) if ((animList[i].collisionDetected) || (animList[i].collisionFromOther)) {
            animList[i].animateResolvePass(maxCDIterations - numIter); 
            hitDetected = true;
        }
        numIter--;
    }

    // Last pass, post-process animation state after collisions are resolved
    for (let i = 0; i < animList.length; ++i) animList[i].animateLastPass();
    
    return maxCDIterations - numIter;
}



// Animation factories



function newTransformAnim(entity, pos_speed, rot_speed, ttl = -1, CD = false, endState = E3D_DONE) {
  //  var repassFunct = (CD) ? anim_Base_rePass : null;
    var endFunct = (ttl > 0.0) ? anim_Base_endPass_ttl : anim_Base_endPass;

    var anim = new E3D_animation("", entity, anim_Transform_firstPass, null, null, endFunct, 0);

    v3_copy(anim.pspd, pos_speed);
    v3_copy(anim.rspd, rot_speed);

    anim.endState = endState;
    anim.ttl = ttl;
    anim.gravity = false;
    anim.state = E3D_PLAY;
    anim.target.visible = true;
    anim.target.resetMatrix();
    anim.last_position = v3_clone(anim.target.position);

    return anim;
}

function newBaseAnim(entity, pos_speed, rot_speed, gravity = 0, ttl = -1, CD = false, endState = E3D_DONE) {

    var SrepassFunct = (CD) ? collisionResult_asSource_bounce : null;
    var TrepassFunct = (CD) ? collisionResult_asTarget_bounce : null;
    var endFunct = (ttl > 0.0) ? anim_Base_endPass_ttl : anim_Base_endPass;
    var anim = new E3D_animation("", entity, anim_Base_firstPass, SrepassFunct, TrepassFunct, endFunct, 0);

    v3_copy(anim.pspd, pos_speed);
    v3_copy(anim.rspd, rot_speed);

    anim.endState = endState;
    anim.ttl = ttl;
    anim.gravity = gravity;
    anim.state = E3D_PLAY;
    anim.target.visible = true;
    anim.target.resetMatrix();
    anim.last_position = v3_clone(anim.target.position);

    return anim;
}    


function newBaseAnim_RelativeToCamera(entity, camera, pos_speed, rot_speed, gravity = 0, ttl = -1, CD = false, endState = E3D_DONE) {

    var SrepassFunct = (CD) ? collisionResult_asSource_bounce : null;
    var TrepassFunct = (CD) ? collisionResult_asTarget_bounce : null;
    var endFunct = (ttl > 0.0) ? anim_Base_endPass_ttl : anim_Base_endPass;

    var anim = new E3D_animation("", entity, anim_Base_firstPass, SrepassFunct, TrepassFunct, endFunct, 0);

    var offset = camera.adjustToCamera(anim.target.position);
    v3_copy(anim.target.position, camera.position);
    v3_add_mod(anim.target.position, offset);

    anim.pspd = camera.adjustToCamera(pos_speed);
    anim.rspd = camera.adjustToCamera(rot_speed);

    anim.endState = endState;
    anim.ttl = ttl;
    anim.gravity = gravity;
    anim.state = E3D_PLAY;
    anim.target.visible = true;
    anim.target.resetMatrix();
    anim.last_position = v3_clone(anim.target.position);

    return anim;
}    


function newParticuleAnim(entity, pos_speed, rot_speed, nbPart, partPosFunc, partDirFunc, gravity = 0, ttl = -1, CD = false, endState = E3D_DONE) {
    var SrepassFunct = (CD) ? collisionResult_asSource_mark : null;
    //var TrepassFunct = (CD) ? collisionResult_asTarget_mark : null;
    var endFunct = (ttl > 0.0) ? anim_Base_endPass_ttl : anim_Base_endPass;

    var anim = new E3D_animation("", entity, anim_Part_firstPass, SrepassFunct, null, endFunct, 0);

    v3_copy(anim.pspd, pos_speed);
    v3_copy(anim.rspd, rot_speed);

    anim.endState = endState;
    anim.ttl = ttl;
    anim.gravity = gravity;
    anim.pCD = CD;

    anim.pNum = nbPart;
    anim.pActive = Array(nbPart);
    anim.pLastPos = Array(nbPart);
    anim.pPos = Array(nbPart);
    anim.pSpd = Array(nbPart);
    anim.pSpdLength = Array(nbPart);

    // clone elements to make the number of particules
    anim.target.setSize(anim.target.srcNumElements * anim.pNum);

    // gen starting positions
    for (let i = 0; i < anim.pNum; ++i) {
        //new pellet
        anim.target.copySource(anim.target.srcNumElements * i);
        anim.pActive[i] = true;
        anim.pLastPos[i] = ((partPosFunc != null) ? partPosFunc(i, nbPart) : v3_new());
    }
    
    // gen particules direction
    for (let i = 0; i < anim.pNum; ++i) {
        anim.pSpd[i] = ((partDirFunc != null) ? partPosFunc(anim.pPos[i], i, nbPart) : v3_new());
        anim.pSpdLength[i] = v3_length(anim.pSpd[i]);        
        anim.pPos[i] = v3_clone(anim.pLastPos[i]);

        //offset pelets vertex by new origin
        for (var j = 0; j < anim.target.srcNumElements; ++j ) {
            var idx = ( i * anim.target.srcNumElements) + j;
            var b = anim.target.getVertex3f(idx);
            v3_add_mod(b, anim.pPos[i])
        }

        if (CD) anim.target.pushCD_point(anim.pPos[i]);
    }

    anim.target.collisionDetection = CD;
    anim.state = E3D_PLAY;
    anim.target.visible = true;
    anim.target.resetMatrix();
    anim.last_position = v3_clone(anim.target.position);

    return anim;
}    


function newParticuleAnim_RelativeToCamera(entity, camera, pos_speed, rot_speed, nbPart, partPosFunc, partDirFunc, gravity = 0, ttl = -1, CD = false, endState = E3D_DONE) {
    var SrepassFunct = (CD) ? collisionResult_asSource_mark : null;
    //var TrepassFunct = (CD) ? collisionResult_asTarget_mark : null;
    var endFunct = (ttl > 0.0) ? anim_Base_endPass_ttl : anim_Base_endPass;

    var anim = new E3D_animation("", entity, anim_Part_firstPass, SrepassFunct, null, endFunct, 0);

    var offset = camera.adjustToCamera(anim.target.position);
    v3_copy(anim.target.position, camera.position);
    v3_add_mod(anim.target.position, offset);

    anim.pspd = camera.adjustToCamera(pos_speed);
    anim.rspd = camera.adjustToCamera(rot_speed);

    anim.endState = endState;
    anim.ttl = ttl;
    anim.gravity = gravity;
    anim.pCD = CD;

    anim.pNum = nbPart;
    anim.pActive = Array(nbPart);
    anim.pLastPos = Array(nbPart);
    anim.pPos = Array(nbPart);
    anim.pSpd = Array(nbPart);
    anim.pSpdLength = Array(nbPart);

    // clone elements to make the number of particules
    anim.target.setSize(anim.target.srcNumElements * anim.pNum);

    // gen starting positions
    for (let i = 0; i < anim.pNum; ++i) {
        //new pellet
        anim.target.copySource(anim.target.srcNumElements * i);
        anim.pActive[i] = true;
        anim.pLastPos[i] = ((partPosFunc != null) ? partPosFunc(i, nbPart) : v3_new());
    }
    
    // gen particules direction
    for (let i = 0; i < anim.pNum; ++i) {
        anim.pSpd[i] = camera.adjustToCamera( ((partDirFunc != null) ? partPosFunc(anim.pPos[i], i, nbPart) : v3_new()) );
        anim.pSpdLength[i] = v3_length(anim.pSpd[i]);        

        anim.pLastPos[i] = camera.adjustToCamera(anim.pLastPos[i]);
        anim.pPos[i] = v3_clone(anim.pLastPos[i]);

        //offset pelets vertex by new origin
        for (var j = 0; j < anim.target.srcNumElements; ++j ) {
            var idx = ( i * anim.target.srcNumElements) + j;
            var b = anim.target.getVertex3f(idx);
            v3_add_mod(b, anim.pPos[i])
        }

        if (CD) anim.target.pushCD_point(anim.pPos[i]);
    }

    anim.target.collisionDetection = CD;
    anim.state = E3D_PLAY;
    anim.target.visible = true;
    anim.target.resetMatrix();
    anim.last_position = v3_clone(anim.target.position);

    return anim;
}    



// Collision resolver functions



function collisionResult_asSource_bounce(){
    if (this.deltaLength > 0) {

        nHits++;
        var firstCol = this.closestCollision[0];
        if (this.colNum > 1) {
            var firstColt0 = this.closestCollision[0].t0;
            for (var i = 1; i < this.colNum; ++i) if (this.closestCollision[i].t0 < firstColt0) {
                firstColt0 = this.closestCollision[i].t0;
                firstCol = this.closestCollision[i]; 
            }
        }

        this.lastHitMarker = ""+firstCol.marker;        

        /*if (show_DEV_CD) { 
            phyTracers.addWireCross(this.last_position, 1, _v3_red);
            phyTracers.addWireCross(firstCol.p0, 1, _v3_green);
            phyTracers.addWireCross(this.target.position, 1, _v3_blue);
        }*/
        
        
        //if (firstCol.t0 < 0.0) { //throw "collision behind initial position: " + firstCol.marker + "@" + firstCol.t0;
        
       // }
        firstCol.t0 = Math.sqrt(Math.abs(firstCol.t0));
        v3_normalize_mod(firstCol.n);
        
        this.pspd[1] += this.frameG;
        
        if (v3_dot(firstCol.n, this.delta) < 0.0) { // face to face
            
            v3_reflect_mod(this.pspd, firstCol.n);
            v3_copy(this.last_position, firstCol.p0); // reset position as per firstHit
            /*
            absorbtion by drag / linear factor

            var remainder = 1.0 - firstCol.t0; // remaining fraction
            remainder = remainder - 0.2;
            if (remainder < 0.0) remainder = 0.0;

            var drag = 0.8;
            v3_scale_mod(this.pspd, drag); // hit speed "drag"

            v3_scale_res(this.delta, this.pspd, remainder * timer.delta * drag); // new delta
            */

            /*
            absorbtion by subtraction
            */
           var remainder = 1.0 - firstCol.t0; // remaining fraction
           if (remainder < 0.0) remainder = 0.0;

           var subvect = v3_reverse_new(firstCol.n);
           v3_mult_mod(this.pspd, subvect);

            v3_scale_res(this.delta, this.pspd, remainder * timer.delta); // new delta
            this.deltaLength = v3_length(this.delta);
            v3_add_res(this.target.position, this.last_position, this.delta); // new position        
        
            this.target.resetMatrix();
        }  //else v3_copy(this.target.position, firstCol.p0);
      
        this.pspd[1] -= this.frameG;

    } //else v3_copy(this.last_position, firstCol.p0); // resset position as per firstHit
}

function collisionResult_asTarget_bounce(){
    var firstCol = this.otherCollision[0];
    if (this.otherColNum > 1) {
        var firstColt0 = this.otherCollision[0].t0;
        for (var i = 1; i < this.otherColNum; ++i) if (this.otherCollision[i].t0 < firstColt0) {
            firstColt0 = this.otherCollision[i].t0;
            firstCol = this.otherCollision[i]; 
        }
    }

    firstCol.t0 = Math.sqrt(Math.abs(firstCol.t0));
    v3_normalize_mod(firstCol.n); // change direction on hit
    v3_addscaled_mod(this.pspd, firstCol.n, -0.15 * v3_length(firstCol.s)); 

    v3_scale_mod(this.pspd, 0.8); // hit "drag"

    v3_scale_res(this.delta, this.pspd, timer.delta);            
    this.deltaLength = v3_length(this.delta);
    if (this.deltaLength < _v3_epsilon) this.deltaLength = _v3_epsilon;
    v3_add_res(this.target.position, this.last_position, this.delta); 

    this.target.resetMatrix();
}


function collisionResult_asSource_mark(){
    this.lastHitMarker = "";
    for (var i = 0; i < this.colNum; ++i) {
        v3_normalize_mod(this.closestCollision[i].n);
        if (show_DEV_CD) { 
            phyTracers.addWireCross(this.closestCollision[i].p0, 2, _v3_green);
            phyTracers.addLineByPosNormLen(this.closestCollision[i].p0, this.closestCollision[i].n, 2, false, _v3_white);
        }
        if (this.closestCollision[i].source_desc == "Point") {
            this.pActive[this.closestCollision[i].source_cdi] = false;
        }
    }
}


function collisionResult_asSource_slide(){
    if (this.deltaLength > 0) {

        nHits++;
        var firstCol = this.closestCollision[0];
        if (this.colNum > 1) {
            var firstColt0 = this.closestCollision[0].t0;
            for (var i = 1; i < this.colNum; ++i) if (this.closestCollision[i].t0 < firstColt0) {
                firstColt0 = this.closestCollision[i].t0;
                firstCol = this.closestCollision[i]; 
            }
        }

        this.lastHitMarker = ""+firstCol.marker;        

        if (firstCol.t0 < 0.0) { // inside

            firstCol.t0 = Math.sqrt(-firstCol.t0);
            v3_normalize_mod(firstCol.n);
            this.pspd[1] += this.frameG;
            v3_copy(this.last_position, firstCol.p0); 

            v3_addscaled_mod(this.pspd, firstCol.n, this.deltaLength * firstCol.t0);

            var remainder = 1.0 - (firstCol.t0 / this.deltaLength); // remaining fraction
            if (remainder < 0.0) remainder = 0.0;

            v3_scale_res(this.delta, this.pspd, timer.delta * remainder);
            this.deltaLength = v3_length(this.delta);
            v3_add_res(this.target.position, this.last_position, this.delta);
            this.target.resetMatrix();
            this.pspd[1] -= this.frameG;

        } else { // along path
            firstCol.t0 = Math.sqrt(firstCol.t0);
            v3_normalize_mod(firstCol.n);
           // this.pspd[1] += this.frameG;
            
            if (v3_dot(firstCol.n, this.delta) < 0.0) { // face to face
                
                v3_copy(this.last_position, firstCol.p0); // reset position as per firstHit

                /* by using absorbtion
                var remainder = 1.0 - (firstCol.t0 / this.deltaLength); // remaining fraction
                if (remainder < 0.0) remainder = 0.0;

                v3_reflect_mod(this.pspd, firstCol.n);
                var nm = v3_scale_new(firstCol.n, 0.8);
                var subvect = v3_reverse_new(nm);
                v3_mult_mod(this.pspd, subvect);
                v3_scale_res(this.delta, this.pspd, remainder * timer.delta * 0.8); 
                */

                /* by using absorbtion, sideways drag and rebound 
                */

                var remainder = 1.0 - (firstCol.t0 / this.deltaLength); // remaining fraction
                if (remainder < 0.0) remainder = 0.0;

                v3_reflect_mod(this.pspd, firstCol.n);
                var pl = v3_length(this.pspd);
                var npl = pl - (2 / timer.delta);
                if (npl < 0.0) npl = 0.0;

                v3_scale_mod(this.pspd, npl / pl);

                //var reboundDrag = v3_scale_new(firstCol.n, 0.2 * timer.delta);
                //var sideDrag = v3_reverse_new(firstCol.n);
                //v3_scale_mod(sideDrag, 0.1 * timer.delta);
                /*
                var steal = 20;
                if (this.pspd[0] > 0.0) {
                    this.pspd[0] -= steal;
                    if (this.pspd[0] < 0.0) this.pspd[0] = 0.0;
                } else {
                    this.pspd[0] += steal;
                    if (this.pspd[0] > 0.0) this.pspd[0] = 0.0;
                }
                if (this.pspd[1] > 0.0) {
                    this.pspd[1] -= steal;
                    if (this.pspd[1] < 0.0) this.pspd[1] = 0.0;
                } else {
                    this.pspd[1] += steal;
                    if (this.pspd[1] > 0.0) this.pspd[1] = 0.0;
                }
                if (this.pspd[2] > 0.0) {
                    this.pspd[2] -= steal;
                    if (this.pspd[2] < 0.0) this.pspd[2] = 0.0;
                } else {
                    this.pspd[2] += steal;
                    if (this.pspd[2] > 0.0) this.pspd[2] = 0.0;
                }
               //subtract vectors without changing direction
*/
                v3_scale_res(this.delta, this.pspd, remainder * timer.delta); 



                /*
                var remainder = 1.0 - (firstCol.t0 / this.deltaLength); // remaining fraction
                remainder = remainder - 0.2;
                if (remainder < 0.0) remainder = 0.0;

                var drag = 0.8;
                v3_scale_mod(this.pspd, drag); // hit speed "drag"
                //if (this.pspd[1] > 0.0) this.pspd[1] *= drag;

                v3_scale_res(this.delta, this.pspd, remainder * timer.delta * drag); // new delta
                
                // project remaining delta on hit plane
                //var offset = v3_mult_new(this.pspd, firstCol.n);
                //v3_sub_mod(this.pspd, offset);
                
            //    v3_addscaled_mod(this.pspd, firstCol.n, v3_length(offset) );
*/
                this.deltaLength = v3_length(this.delta);
                v3_add_res(this.target.position, this.last_position, this.delta); // new position        
            
                this.target.resetMatrix();
            } // face to face  
          //  this.pspd[1] -= this.frameG;
        } // t0 < 0
    } // deltalength > 0
}



function collisionResult_asTarget_mark(){
    for (var i = 0; i < this.otherColNum; ++i) {
        v3_normalize_mod(this.collisionFromOther[i].n);
        if (show_DEV_CD) { 
            phyTracers.addWireCross(this.collisionFromOther[i].p0, 2, _v3_red);
            phyTracers.addLineByPosNormLen(this.collisionFromOther[i].p0, this.collisionFromOther[i].n, 2, false, _v3_white);
        }
    }
}



// First pass basic methods



function anim_Base_firstPass(){
    if (this.state == E3D_PLAY) {

        v3_copy(this.last_position, this.target.position);
        v3_scale_res(this.delta, this.pspd, timer.delta);  

        this.frameG = gAccel * this.gravity;
        this.pspd[1] -= this.frameG;

        v3_add_mod(this.target.position, this.delta);
        this.deltaLength = v3_length(this.delta);

        this.target.resetMatrix();
        this.lastHitMarker = ""; 
    }
}

function anim_Transform_firstPass() {
    if (this.state == E3D_PLAY) {

        v3_copy(this.last_position, this.target.position);

        v3_scale_res(this.delta, this.pspd, timer.delta);  
        v3_add_mod(this.target.position, this.delta);
        this.deltaLength = v3_length(this.delta);

        v3_addscaled_mod(this.target.rotation, this.rspd, timer.delta);

        this.target.resetMatrix();
        this.lastHitMarker = ""; 
    }
}

function anim_Part_firstPass() {
    if (this.state == E3D_PLAY) {

        // Transform
        v3_copy(this.last_position, this.target.position);
        v3_scale_res(this.delta, this.pspd, timer.delta);  

        this.frameG = gAccel * this.gravity;
        this.pspd[1] -= this.frameG;

        v3_add_mod(this.target.position, this.delta);
        this.deltaLength = v3_length(this.delta);

        // Remove deactivated particules
        for (let i = this.pNum-1; i >= 0; --i) if (!this.pActive[i]) {
            this.pNum--;
            this.pActive.splice(i, 1);
            this.pLastPos.splice(i, 1);
            this.pPos.splice(i, 1);
            this.pSpd.splice(i, 1);
            this.pSpdLength.splice(i, 1);

            for (var k = i+1; k < this.pNum; ++k) { // bubble up the remeaining vertex
                for (var j = 0; j < this.target.srcNumElements; ++j ) {
                    var nextIndex = ( k * this.target.srcNumElements) + j;
                    var prevIndex = ( (k-1) * this.target.srcNumElements) + j;
                    this.target.setVertex3f(prevIndex, this.target.getVertex3f(nextIndex));
                }
            }
            this.target.numElements -= this.target.srcNumElements;
            if (this.pCD) {
                this.target.CD_point--;
                this.target.CD_point_p0.splice(i, 1);
                this.target.CD_point_p.splice(i, 1);
            }

        }

        var max = v3_new();
        // Animate particules
        for (let i = 0; i < this.pNum; ++i) { 

            v3_copy(this.pLastPos[i], this.pPos[i]);
            v3_addscaled_mod(this.pPos[i], this.pSpd[i], timer.delta);

            // translate pellet entity elements
            for (var j = 0; j < this.target.srcNumElements; ++j ) {
                var b = this.target.getVertex3f( ( i * this.target.srcNumElements ) + j); // b is a view in float32array
                v3_addscaled_mod(b, this.pSpd[i], timer.delta);
                if (Math.abs(b[0]) > max[0]) max[0] = Math.abs(b[0]);
                if (Math.abs(b[1]) > max[1]) max[1] = Math.abs(b[1]);
                if (Math.abs(b[2]) > max[2]) max[2] = Math.abs(b[2]);
            }

            if (this.pCD) v3_copy(this.target.CD_point_p0[i], this.pPos[i]); 
        }

        this.target.cull_dist = v3_length(max);
        this.target.dataContentChanged = true;
        this.target.resetMatrix();
        this.lastHitMarker = ""; 
    }
}



// End pass basic functions



function anim_Base_endPass_ttl() {
    this.ttl -= timer.delta;

    if (this.ttl < 0) {
        this.state = this.endState;
        this.target.visible = false;
    }
}

function anim_Base_endPass() {
    if (this.state == E3D_DONE) this.target.visible = false;
}



// Helper functions



function cleanupDoneAnimations(animations, scn) {
    var someremoved = false;
    for (let i = animations.length -1; i >=0; --i) if (animations[i].state == E3D_DONE) {
        scn.removeEntity(animations[i].target.id, false);
        animations.splice(i, 1);
        someremoved = true;
    }
    // Recalc indices until animations are merged with entities
    if (someremoved) for (let i = 0; i < animations.length; ++i) animations[i].target.animIndex = i;
}

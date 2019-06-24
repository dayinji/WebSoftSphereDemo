import $ from "jquery";
import * as dat from 'dat.gui';
import * as THREE from "three";
import spFrag from './shader/spFrag.glsl'
import spVert from './shader/spVert.glsl'

var renderController, gui;
var softSpheres = [];
var sphereNum = 100;
var gravity = new THREE.Vector3(0, 0, 0);
var boundPos = {
    left: -window.innerWidth/2,
    right: window.innerWidth/2,
    top: window.innerHeight/2,
    bottom: -window.innerHeight/2,
}

var options = {
    roundRadiusFactor: 1,
    collisionFactor: 1,
    opacity: 0.8,
    frosted: false
};

init();
animate();

function SoftSphere () {
    this.isInteract = false;
    this.touchstartPos = null;
    this.backupPos = null;
    this.init = function(){
        let avergeRadius = Math.sqrt(window.innerWidth * window.innerHeight / sphereNum / Math.PI);
        this.baseRadius = getRandomNum(avergeRadius/2, avergeRadius*3/2);
        this.radius = this.baseRadius;
        this.speed = getRandomNum(0.3, 1);
        this.offset = getRandomNum(0, Math.PI*2);
        this.amp = getRandomNum(0, this.baseRadius*0.3);
        this.position = new THREE.Vector3(getRandomNum(boundPos.left+this.radius, boundPos.right-this.radius),getRandomNum(boundPos.bottom+this.radius, boundPos.top-this.radius),0);
        this.vel = new THREE.Vector3();
        this.geometry = new THREE.SphereBufferGeometry( 1, 64, 64 );
        this.uniforms = {
            // 全局信息
            time: {type: 'f', value: 0},
            lightPosition: { type: 'v3', value: new THREE.Vector3(-1000, 2000, 400) },
            cameraPos: {type: "v3", value: new THREE.Vector3(0, 0, 800)},

            // 球体信息
            pos: {type: "v3", value: this.position},
            radius: {type: "f", value: this.radius},

            // 球体颜色
            bgType: {type: "f", value: 0},
            bgColor1: {type: "v3", value: new THREE.Vector3()},
            bgColor2: {type: "v3", value: new THREE.Vector3()},

            // 碰撞信息
            cutPoints: {type: "v3v", value: []},
            cutNormals: {type: "v3v", value: []},
            cutRange: {type: "fv", value: []},

            // 自定义可控参数
            roundRadiusFactor: {type: "f", value: 0.0},
            collisionFactor: {type: "f", value: 0.0},
            opacity: {type: "f", value: 0.5},
            frosted: {type: "f", value: 0.0}
        }
        this.material = new THREE.RawShaderMaterial( {
            uniforms:  this.uniforms,
            vertexShader: spVert,
            fragmentShader: spFrag,
            transparent: true,
        } );
        this.mesh = new THREE.Mesh( this.geometry, this.material );
        
        // 随机设置球体的颜色
        this.setBackgroundColor();
    }
    
    this.setBackgroundColor = function() {
        // 随机赋予三种不同的颜色
        let rand = Math.random();
        if (rand < 0.33) {
            // Solid：纯色
            this.uniforms.bgType.value = 0.0;
            let c1 = getRandomColor();
            this.uniforms.bgColor1.value = new THREE.Vector3(c1.r, c1.g, c1.b);
            this.uniforms.bgColor2.value = new THREE.Vector3(c1.r, c1.g, c1.b);
        } else if (rand < 0.66) {
            // Gradient Vertical：竖直方向的渐变
            this.uniforms.bgType.value = 1.0;
            let c1 = getRandomColor();
            let c2 = getRandomColor();
            this.uniforms.bgColor1.value = new THREE.Vector3(c1.r, c1.g, c1.b);
            this.uniforms.bgColor2.value = new THREE.Vector3(c2.r, c2.g, c2.b);
        } else {
            // Gradient Lefttop：斜方向的渐变
            this.uniforms.bgType.value = 2.0;
            let c1 = getRandomColor();
            let c2 = getRandomColor();
            this.uniforms.bgColor1.value = new THREE.Vector3(c1.r, c1.g, c1.b);
            this.uniforms.bgColor2.value = new THREE.Vector3(c2.r, c2.g, c2.b);
        }
    }

    this.updatePosition = function(){
        // 如果此球正在交互状态，直接返回
        if (this.isInteract) return;
        let force = new THREE.Vector3().add(gravity);
        for (let i = 0 ; i < softSpheres.length ; i++) {
            // 如果 softSpheres[i] 不是此球，计算它们之间的作用力
            if (softSpheres[i] != this) {
                let other = softSpheres[i];
                let between =  this.position.clone().sub(other.position);
                let dist = between.length();
                let touchDist = this.radius + other.radius;
                // 如果两球交叉，则有斥力
                if (dist < touchDist){
                    force.add(between.normalize().multiplyScalar((touchDist-dist)*0.05));
                }
            }
        }
        let timeDelta = 1;
        let decay = 0.9;
        // 速度 += 加速度（力*时间）
        this.vel.add(force.multiplyScalar(timeDelta));
        // decay 为阻力因子
        this.vel.multiplyScalar(decay);
        // 控制速率在50以内，防止速度过大
        this.vel.multiplyScalar(Math.min(1.0, 50.0/this.vel.length()));
        // 位置 += 位移（速度*时间）
        this.position.add(this.vel.multiplyScalar(timeDelta));

        // 限制球体位置在我们设定的 bound 边界内，并且保持 z 为0
        this.position.x = this.constrain(this.position.x, boundPos.left, boundPos.right);
        this.position.y = this.constrain(this.position.y, boundPos.bottom, boundPos.top);
        this.position.z = 0;
    }
    this.constrain = function(v, min, max) {
        return Math.max(min + this.radius, Math.min(max - this.radius, v));
    }
    this.updateUniforms = function(time) {
        this.uniforms.time.value = time;
        this.uniforms.pos.value = this.position;
        this.uniforms.radius.value = this.radius;
        // cutPoints、cutNormals、cutRange 用于记录碰撞面信息
        this.uniforms.cutPoints.value = [];
        this.uniforms.cutNormals.value = [];
        this.uniforms.cutRange.value = [];
        // roundRadiusFactor、collisionFactor 是自定义参数
        this.uniforms.roundRadiusFactor.value = options.roundRadiusFactor;
        this.uniforms.collisionFactor.value = options.collisionFactor;
        this.uniforms.opacity.value = options.opacity;
        this.uniforms.frosted.value = options.frosted ? 1.0 : 0.0;

        for (let i = 0 ; i < softSpheres.length ; i++) {
            if (softSpheres[i] != this) {
                let other = softSpheres[i];
                let between = other.position.clone().sub(this.position);
                let dist = between.length();
                // 若两球存在交叉，则计算碰撞面信息
                if (dist < this.radius + other.radius) {
                    // 求两相交圆的交点坐标，算法介绍在下面链接：
                    // https://blog.csdn.net/mr_hcw/article/details/82861431
                    let angleA = Math.acos((other.radius*other.radius - this.radius*this.radius - dist*dist)/(-2*this.radius*dist));
                    let angleT = Math.atan2(between.y, between.x);
                    let angle1 = angleT + angleA;
                    let angle2 = angleT - angleA;

                    // 把画面当做沿z方向望过去的二维平面，p1 p2 是两交叉【圆】的两个相交点。
                    let p1 = new THREE.Vector3(Math.cos(angle1), Math.sin(angle1), 0).multiplyScalar(this.radius).add(this.position);
                    let p2 = new THREE.Vector3(Math.cos(angle2), Math.sin(angle2), 0).multiplyScalar(this.radius).add(this.position);

                    this.uniforms.cutPoints.value.push(p1.clone().add(p2).multiplyScalar(0.5));
                    this.uniforms.cutNormals.value.push(between.clone().multiplyScalar(-1).normalize());
                    this.uniforms.cutRange.value.push(p1.clone().sub(p2).length()*0.5);
                }
            }
        }
        // 不足47个碰撞信息，则填空
        for (let i = this.uniforms.cutPoints.value.length ; i < 47 ; i++) {
            this.uniforms.cutPoints.value.push(new THREE.Vector3(999, 999, 0));
            this.uniforms.cutNormals.value.push(new THREE.Vector3(999, 999, 0));
            this.uniforms.cutRange.value.push(0);
        }
    }
    this.updateRadius = function(time) {
        if (time) {
            this.radius = this.baseRadius + Math.sin(time/1000.0*this.speed + this.offset)*this.baseRadius*0.1;
            this.radius = Math.max(20, this.radius);
        }
    }
    this.touchstart = function(e) {
        let x = e.touches[0].pageX;
        let y = e.touches[0].pageY;
        var mapPos = this.mapCroods(x, y);
        if (mapPos.distanceTo(this.position) < this.radius) {
            this.isInteract = true;
            this.touchstartPos = this.mapCroods(x, y);
            this.backupPos = this.position.clone();
        }
        return this.isInteract;
    }
    this.touchmove = function(e) {
        if (this.isInteract) {
            let x = e.touches[0].pageX;
            let y = e.touches[0].pageY;
            let pos = this.mapCroods(x, y);
            this.position = this.backupPos.clone().add(pos.sub(this.touchstartPos));
        }
    }
    this.touchend = function(e) {
        this.isInteract = false;
    }
    this.mousedown = function(e) {
        let x = e.pageX;
        let y = e.pageY;
        var mapPos = this.mapCroods(x, y);
        if (mapPos.distanceTo(this.position) < this.radius) {
            this.isInteract = true;
            this.touchstartPos = this.mapCroods(x, y);
            this.backupPos = this.position.clone();
        }
        return this.isInteract;
    }
    this.mousemove = function(e) {
        if (this.isInteract) {
            let x = e.pageX;
            let y = e.pageY;
            let pos = this.mapCroods(x, y);
            this.position = this.backupPos.clone().add(pos.sub(this.touchstartPos));
        }
    }
    this.mouseup = function(e) {
        this.isInteract = false;
    }
    this.mapCroods = function(x, y) {
        return new THREE.Vector3(x-window.innerWidth/2, -y+window.innerHeight/2, this.position.z)
    }
    this.iMapCroods = function(x, y) {
        return new THREE.Vector2(x+window.innerWidth/2, -y+window.innerHeight/2)
    }
    this.anim = function(time) {
        this.updateRadius(time);
        this.updatePosition(time);
        this.updateUniforms(time);
    }
    this.init();
}

function RenderController() {

    this.init = function() {
        this.camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, 1, 100000 );
        this.camera.lookAt(new THREE.Vector3());
        this.camera.position.set( 0, 0, 800 );
        
        this.scene = new THREE.Scene();
     
        this.renderer = new THREE.WebGLRenderer( { 
            antialias: true,
            alpha: true
        } );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    
        let wrapper = document.getElementById("wrapper");
        wrapper.appendChild( this.renderer.domElement );

        // 初始化重力感应交互
        this.initGyroNorm();
        // 初始化鼠标&触摸交互
        this.initTouchInteract();
    }
    this.anim = function(time) {
        for (let i = 0 ; i < softSpheres.length ; i++) {
            softSpheres[i].anim(time);
        }
        this.renderer.render( this.scene, this.camera );
    }
        
    // 初始化鼠标&触摸交互
    this.initTouchInteract = function() {
        let canvas = this.renderer.domElement;
        canvas.addEventListener("touchstart", function(e) {
            this.touchstart(e);
        }.bind(this))
        canvas.addEventListener("touchmove", function(e) {
            this.touchmove(e);
            e.preventDefault();
        }.bind(this))
        canvas.addEventListener("touchend", function(e) {
            this.touchend(e);
        }.bind(this))
        canvas.addEventListener("mousedown", function(e) {
            this.mousedown(e);
        }.bind(this))
        canvas.addEventListener("mousemove", function(e) {
            this.mousemove(e);
        }.bind(this))
        canvas.addEventListener("mouseup", function(e) {
            this.mouseup(e);
        }.bind(this))
    }
    this.touchstart = function(e) {
        for(let i = 0 ; i < softSpheres.length ; i++){
            if (softSpheres[i].touchstart(e))
                break;
        }
    }
    this.touchmove = function(e) {
        for(let i = 0 ; i < softSpheres.length ; i++){
            softSpheres[i].touchmove(e)
        }
    }
    this.touchend = function(e) {
        for(let i = 0 ; i < softSpheres.length ; i++){
            softSpheres[i].touchend(e)
        }
    }
    this.mousedown = function(e) {
        for(let i = 0 ; i < softSpheres.length ; i++){
            if (softSpheres[i].mousedown(e))
                break;
        }
    }
    this.mousemove = function(e) {
        for(let i = 0 ; i < softSpheres.length ; i++){
            softSpheres[i].mousemove(e)
        }
    }
    this.mouseup = function(e) {
        for(let i = 0 ; i < softSpheres.length ; i++){
            softSpheres[i].mouseup(e)
        }
    }
    // 初始化移动端重力感应交互
    this.initGyroNorm = function(){
        var gn = new GyroNorm();
        gn.init().then(function(){
            gn.start(function(data){
                gravity = new THREE.Vector3(0, -1, 0);
                gravity.applyAxisAngle(new THREE.Vector3(1, 0, 0), (data.do.beta-90)/180*Math.PI);
                gravity.applyAxisAngle(new THREE.Vector3(0, 1, 0), data.do.gamma/180*Math.PI);
                gravity.multiplyScalar(1);

                for (let i = 0 ; i < softSpheres.length ; i++){
                    let sp = softSpheres[i];
                    sp.vel.add(new THREE.Vector3(data.dm.x, data.dm.y, data.dm.z).multiplyScalar(0.5));
                }
            }.bind(this));
        }).catch(function(e){
        });
    }
    this.init();
}

function init() {
    renderController = new RenderController();
    softSpheres = [];
    for (let i = 0 ; i < sphereNum ; i++) {
        let sp = new SoftSphere(Math.random()*24);
        softSpheres.push(sp);
        renderController.scene.add(sp.mesh);
    }
    $("#wrapper").bind("touchmove", function(e) {
        e.preventDefault();
    })
    initGUI();
}

function initGUI() {
    gui = new dat.GUI();
    var guiRound = gui.addFolder('Control');
    guiRound.add(options, 'roundRadiusFactor', 0, 1).name('roundRadius').listen();
    guiRound.add(options, 'collisionFactor', 0, 1).name('collisionFactor').listen();
    guiRound.add(options, 'opacity', 0, 1).name('opacity').listen();
    guiRound.add(options, 'frosted').name('frosted').listen();
    guiRound.open();
}

function animate(time) {
    requestAnimationFrame( animate );
    renderController.anim(time);
}

function getRandomNum(min, max){
    return Math.random() * (max - min) + min;
}

function getRandomColor() {
    let color = new THREE.Color( 0xffffff );
    color.setHex( Math.random() * 0xffffff );
    return color;
}
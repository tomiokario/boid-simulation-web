// ボイドシミュレーター - メインJavaScriptファイル

// グローバル変数
let boids = [];
let prey = null;
let hunters = [];
let isRunning = true;
let canvasWidth = 800;
let canvasHeight = 600;
let lastTime = 0;  // 前回のフレーム時間
const targetFPS = 60;  // 目標FPS
const timeStep = 1000 / targetFPS;  // 1フレームあたりの時間（ミリ秒）

// シミュレーションパラメータ
let params = {
    // 基本パラメータ
    agentCount: 256,
    minVel: 0.3,
    maxVel: 0.3,
    
    // 結合力
    cohesionForce: 0.008,
    cohesionDistance: 0.8,
    cohesionAngle: 0.3,
    
    // 分離力
    separationForce: 1.2,
    separationDistance: 0.08,
    separationAngle: 0.6,
    
    // 分離速度
    separationSpeedForce: 2.0,
    separationSpeedDistance: 0.15,  // 分離力の距離より大きい値
    
    // 整列力
    alignmentForce: 0.04,
    alignmentDistance: 0.5,
    alignmentAngle: 0.2,
    
    // 餌パラメータ
    preyForce: 0.54,
    preyMovementStep: 300,
    
    // 外敵パラメータ
    hunterCount: 5,
    hunterForce: 1.08,
    escapeForce: 0.9,
    hunterNClosest: 10,
    hunterSpeed: 0.5
};

// 現在のシミュレーションモード
let simulationMode = 'hunter'; // 'basic', 'prey', 'hunter'

// プリセット設定
const presets = {
    default: {
        // デフォルト設定 - バランスの取れた群れ行動
        cohesionForce: 0.008,
        cohesionDistance: 0.8,
        cohesionAngle: 0.3,
        separationForce: 1.2,
        separationDistance: 0.08,
        separationAngle: 0.6,
        separationSpeedForce: 2.0,
        separationSpeedDistance: 0.15,
        alignmentForce: 0.04,
        alignmentDistance: 0.5,
        alignmentAngle: 0.2,
        // 外敵パラメータ
        hunterCount: 5,
        hunterForce: 1.08,
        escapeForce: 0.9,
        hunterSpeed: 0.5
    },
    torus: {
        // トーラス設定 - より広い範囲での群れ行動
        cohesionForce: 0.004,
        cohesionDistance: 1.2,
        cohesionAngle: 0.3,
        separationForce: 1.2,
        separationDistance: 0.08,
        separationAngle: 0.6,
        separationSpeedForce: 2.0,
        separationSpeedDistance: 0.15,
        alignmentForce: 0.02,
        alignmentDistance: 1.0,
        alignmentAngle: 0.2,
        // 外敵パラメータ
        hunterCount: 3,
        hunterForce: 0.9,
        escapeForce: 1.2,
        hunterSpeed: 0.7
    },
    dynamic_parallel: {
        // 動的並列設定 - より強い整列性
        cohesionForce: 0.008,
        cohesionDistance: 0.8,
        cohesionAngle: 0.3,
        separationForce: 1.2,
        separationDistance: 0.08,
        separationAngle: 0.6,
        separationSpeedForce: 2.0,
        separationSpeedDistance: 0.15,
        alignmentForce: 0.06,
        alignmentDistance: 1.5,
        alignmentAngle: 0.2,
        // 外敵パラメータ
        hunterCount: 7,
        hunterForce: 1.2,
        escapeForce: 1.0,
        hunterSpeed: 0.6
    }
};

// ボイドクラス
class Boid {
    constructor(x, y) {
        this.position = createVector(x || random(width), y || random(height));
        this.velocity = p5.Vector.random2D();
        this.velocity.mult(random(params.minVel, params.maxVel));
        this.acceleration = createVector(0, 0);
        this.maxSpeed = params.maxVel;
        this.maxForce = 1.08;
        this.radius = 3;
        this.trail = [];
        this.maxTrailLength = 50;
        
        // パステルカラーの色を設定
        this.hue = random(180, 300); // 水色、薄い黄色、薄い緑色の範囲
        this.saturation = 40; // 低めの彩度
        this.brightness = 90; // 高めの明度
    }

    // ボイド同士の衝突判定メソッドを追加
    isCollidingWithBoid(otherBoid) {
        let d = p5.Vector.dist(this.position, otherBoid.position);
        return d < (this.radius + otherBoid.radius);
    }

    // 衝突判定メソッドを追加
    isCollidingWith(hunter) {
        let d = p5.Vector.dist(this.position, hunter.position);
        return d < (this.radius + hunter.radius);
    }

    // トーラス距離を計算する補助関数
    torusDistance(pos1, pos2) {
        let dx = Math.abs(pos1.x - pos2.x);
        let dy = Math.abs(pos1.y - pos2.y);
        
        // トーラス境界を考慮した距離計算
        dx = Math.min(dx, width - dx);
        dy = Math.min(dy, height - dy);
        
        return Math.sqrt(dx * dx + dy * dy);
    }

    // トーラス位置を考慮した位置計算
    torusPosition(pos) {
        let x = pos.x;
        let y = pos.y;
        
        // トーラス境界を考慮した位置計算
        if (x < 0) x += width;
        if (x > width) x -= width;
        if (y < 0) y += height;
        if (y > height) y -= height;
        
        return createVector(x, y);
    }

    // 3つの基本的な力を計算
    flock(boids) {
        let sep = this.separate(boids);
        let sepSpeed = this.separateSpeed(boids);
        let ali = this.align(boids);
        let coh = this.cohesion(boids);

        // 力の重み付け
        sep.mult(params.separationForce);
        sepSpeed.mult(params.separationSpeedForce);
        ali.mult(params.alignmentForce);
        coh.mult(params.cohesionForce);

        // 加速度に力を適用
        this.acceleration.add(sep);
        this.acceleration.add(sepSpeed);
        this.acceleration.add(ali);
        this.acceleration.add(coh);
    }

    // 分離力 - 近くのボイドから離れる
    separate(boids) {
        let steer = createVector(0, 0);
        let count = 0;

        for (let other of boids) {
            let d = this.torusDistance(this.position, other.position);
            if (d > 0 && d < params.separationDistance * 100) {
                let diff = p5.Vector.sub(this.position, other.position);
                // トーラス境界を考慮した方向ベクトルの計算
                if (Math.abs(diff.x) > width/2) {
                    diff.x = diff.x > 0 ? diff.x - width : diff.x + width;
                }
                if (Math.abs(diff.y) > height/2) {
                    diff.y = diff.y > 0 ? diff.y - height : diff.y + height;
                }
                diff.normalize();
                diff.mult(params.separationForce);
                steer.add(diff);
                count++;
            }
        }

        if (count > 0) {
            steer.div(count);
            steer.normalize();
            steer.mult(this.maxSpeed);
            steer.sub(this.velocity);
            steer.limit(this.maxForce);
        }
        return steer;
    }

    // 分離速度 - 近くのボイドから離れる速度を制御
    separateSpeed(boids) {
        let steer = createVector(0, 0);
        let count = 0;

        for (let other of boids) {
            let d = this.torusDistance(this.position, other.position);
            if (d > 0 && d < params.separationSpeedDistance * 100) {
                let diff = p5.Vector.sub(this.position, other.position);
                // トーラス境界を考慮した方向ベクトルの計算
                if (Math.abs(diff.x) > width/2) {
                    diff.x = diff.x > 0 ? diff.x - width : diff.x + width;
                }
                if (Math.abs(diff.y) > height/2) {
                    diff.y = diff.y > 0 ? diff.y - height : diff.y + height;
                }
                diff.normalize();
                
                // 距離に応じた重み付けを計算
                let weight = 1.0 - (d / (params.separationSpeedDistance * 100));
                weight = weight * weight;  // 非線形性を持たせる
                
                // 速度に重みを適用
                diff.mult(weight * params.separationSpeedForce);
                steer.add(diff);
                count++;
            }
        }

        if (count > 0) {
            steer.div(count);
            steer.normalize();
            steer.mult(this.maxSpeed);
            steer.sub(this.velocity);
            steer.limit(this.maxForce);
        }
        return steer;
    }

    // 整列力 - 近くのボイドと同じ方向に向く
    align(boids) {
        let sum = createVector(0, 0);
        let count = 0;

        for (let other of boids) {
            let d = this.torusDistance(this.position, other.position);
            if (d > 0 && d < params.alignmentDistance * 100) {
                sum.add(other.velocity);
                count++;
            }
        }

        if (count > 0) {
            sum.div(count);
            sum.normalize();
            sum.mult(this.maxSpeed);
            let steer = p5.Vector.sub(sum, this.velocity);
            steer.limit(this.maxForce);
            return steer;
        }
        return createVector(0, 0);
    }

    // 結合力 - 近くのボイドの中心に向かう
    cohesion(boids) {
        let sum = createVector(0, 0);
        let count = 0;

        for (let other of boids) {
            let d = this.torusDistance(this.position, other.position);
            if (d > 0 && d < params.cohesionDistance * 100) {
                // トーラス境界を考慮した位置の計算
                let otherPos = this.torusPosition(other.position);
                sum.add(otherPos);
                count++;
            }
        }

        if (count > 0) {
            sum.div(count);
            return this.seek(sum);
        }
        return createVector(0, 0);
    }

    // 目標に向かう力
    seek(target) {
        let desired = p5.Vector.sub(target, this.position);
        desired.normalize();
        desired.mult(this.maxSpeed);

        let steer = p5.Vector.sub(desired, this.velocity);
        steer.limit(this.maxForce);
        return steer;
    }

    // 餌に向かう力
    seekPrey(preyPos) {
        if (!preyPos) return createVector(0, 0);
        
        let force = this.seek(preyPos);
        force.mult(params.preyForce);
        return force;
    }

    // 外敵から逃げる力
    escapeFromHunters(hunters) {
        let steer = createVector(0, 0);
        
        for (let hunter of hunters) {
            let d = p5.Vector.dist(this.position, hunter.position);
            if (d < 150) { // 外敵の影響範囲
                let diff = p5.Vector.sub(this.position, hunter.position);
                diff.normalize();
                diff.div(d); // 距離で重み付け
                steer.add(diff);
            }
        }
        
        if (steer.mag() > 0) {
            steer.normalize();
            steer.mult(this.maxSpeed);
            steer.sub(this.velocity);
            steer.limit(this.maxForce);
            steer.mult(params.escapeForce);
        }
        
        return steer;
    }

    // 位置と速度の更新
    update(deltaTime) {
        // 現在の位置を軌跡に追加
        this.trail.push(this.position.copy());
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift(); // 古い位置を削除
        }

        // 加速度を時間でスケーリング
        this.acceleration.mult(deltaTime);
        
        // 速度を更新
        this.velocity.add(this.acceleration);
        this.velocity.limit(this.maxSpeed);
        
        // 位置を更新（速度を時間でスケーリング）
        let scaledVelocity = this.velocity.copy();
        scaledVelocity.mult(deltaTime);
        this.position.add(scaledVelocity);
        
        // 加速度をリセット
        this.acceleration.mult(0);

        // 速度の下限チェック
        if (this.velocity.mag() < params.minVel) {
            this.velocity.normalize();
            this.velocity.mult(params.minVel);
        }

        // トーラス境界条件
        let crossedBoundary = false;
        if (this.position.x < 0) {
            this.position.x = width;
            crossedBoundary = true;
        } else if (this.position.x > width) {
            this.position.x = 0;
            crossedBoundary = true;
        }
        
        if (this.position.y < 0) {
            this.position.y = height;
            crossedBoundary = true;
        } else if (this.position.y > height) {
            this.position.y = 0;
            crossedBoundary = true;
        }

        // 境界を超えた場合は軌跡をクリア
        if (crossedBoundary) {
            this.trail = [];
        }
    }

    // 描画
    show() {
        // 軌跡を描画
        noFill();
        for (let i = 0; i < this.trail.length - 1; i++) {
            let alpha = map(i, 0, this.trail.length - 1, 5, 150);
            colorMode(HSB);
            stroke(this.hue, this.saturation, this.brightness, alpha);
            strokeWeight(map(i, 0, this.trail.length - 1, 0.3, 2));
            line(this.trail[i].x, this.trail[i].y, this.trail[i + 1].x, this.trail[i + 1].y);
        }
        
        // ボイド本体を描画
        colorMode(HSB);
        fill(this.hue, this.saturation, this.brightness, 150);
        stroke(this.hue, this.saturation, this.brightness);
        strokeWeight(1);
        ellipse(this.position.x, this.position.y, 6, 6);
    }

    // ランダムな位置にワープするメソッドを追加
    warpToRandomPosition() {
        this.position = createVector(random(width), random(height));
        // ワープ後は速度を少し下げる
        this.velocity.mult(0.8);
        // 軌跡をクリア
        this.trail = [];
    }
}

// 餌クラス
class Prey {
    constructor() {
        this.position = createVector(random(width), random(height));
        this.timer = 0;
    }

    update(deltaTime) {
        this.timer += deltaTime;
        if (this.timer >= params.preyMovementStep) {
            this.position = createVector(random(width), random(height));
            this.timer = 0;
        }
    }

    show() {
        fill(255, 100, 100);
        noStroke();
        ellipse(this.position.x, this.position.y, 12, 12);
    }
}

// 外敵クラス
class Hunter extends Boid {
    constructor() {
        super();
        this.isHunter = true;
        this.radius = 4; // 外敵の衝突判定用の半径を設定
        this.maxSpeed = params.maxVel * (1 + params.hunterSpeed); // ハンターの速度を設定
    }

    // 外敵同士の分離機能を追加
    separateFromHunters(hunters) {
        let steer = createVector(0, 0);
        let count = 0;

        for (let other of hunters) {
            if (other === this) continue; // 自分自身はスキップ
            
            let d = p5.Vector.dist(this.position, other.position);
            if (d > 0 && d < 50) { // 外敵同士の分離距離
                let diff = p5.Vector.sub(this.position, other.position);
                diff.normalize();
                diff.div(d); // 距離で重み付け
                steer.add(diff);
                count++;
            }
        }

        if (count > 0) {
            steer.div(count);
            steer.normalize();
            steer.mult(this.maxSpeed);
            steer.sub(this.velocity);
            steer.limit(this.maxForce);
            steer.mult(1.5); // 分離力の強さを調整
        }
        return steer;
    }

    // 外敵同士の衝突判定メソッドを追加
    isCollidingWithHunter(otherHunter) {
        let d = p5.Vector.dist(this.position, otherHunter.position);
        return d < (this.radius + otherHunter.radius);
    }

    // ランダムな位置にワープするメソッドを追加
    warpToRandomPosition() {
        this.position = createVector(random(width), random(height));
        // ワープ後は速度を少し下げる
        this.velocity.mult(0.8);
        // 軌跡をクリア
        this.trail = [];
    }

    update(boids, deltaTime) {
        // 最も近いボイドたちの平均位置に向かう
        let closestBoids = this.getClosestBoids(boids, params.hunterNClosest);
        if (closestBoids.length > 0) {
            let avgPos = createVector(0, 0);
            for (let boid of closestBoids) {
                avgPos.add(boid.position);
            }
            avgPos.div(closestBoids.length);
            
            let direction = p5.Vector.sub(avgPos, this.position);
            direction.normalize();
            direction.mult(params.hunterForce * deltaTime);  // 時間でスケーリング
            this.acceleration.add(direction);
        }
        
        // 外敵同士の分離を追加
        let separationForce = this.separateFromHunters(hunters);
        this.acceleration.add(separationForce);
        
        // ボイドとの分離を無効化（ボイドに近づいても離れないようにする）
        // this.flock(boids);  // この行をコメントアウトまたは削除
        
        // 親クラスのupdateメソッドを呼び出し
        super.update(deltaTime);
    }

    getClosestBoids(boids, count) {
        let distances = boids.map(boid => ({
            boid: boid,
            distance: p5.Vector.dist(this.position, boid.position)
        }));
        
        distances.sort((a, b) => a.distance - b.distance);
        return distances.slice(0, count).map(item => item.boid);
    }

    show() {
        // 軌跡を描画
        noFill();
        for (let i = 0; i < this.trail.length - 1; i++) {
            let alpha = map(i, 0, this.trail.length - 1, 5, 150);
            colorMode(HSB);
            stroke(0, 60, 90, alpha); // 柔らかい赤色
            strokeWeight(map(i, 0, this.trail.length - 1, 0.3, 2));
            line(this.trail[i].x, this.trail[i].y, this.trail[i + 1].x, this.trail[i + 1].y);
        }
        
        // 外敵本体を描画
        colorMode(HSB);
        fill(0, 60, 90, 150); // 柔らかい赤色
        stroke(0, 60, 90);
        strokeWeight(2);
        ellipse(this.position.x, this.position.y, 8, 8);
    }
}

// p5.js セットアップ
function setup() {
    // キャンバスサイズを動的に設定
    let container = document.getElementById('canvas-container');
    canvasWidth = container.offsetWidth;
    canvasHeight = container.offsetHeight;
    
    let canvas = createCanvas(canvasWidth, canvasHeight);
    canvas.parent('canvas-container');
    
    // ボイドを初期化
    initializeBoids();
    
    // UIイベントリスナーを設定
    setupUI();
}

// ボイドの初期化
function initializeBoids() {
    boids = [];
    for (let i = 0; i < params.agentCount; i++) {
        boids.push(new Boid());
    }
    
    // 餌の初期化
    if (simulationMode === 'prey') {
        prey = new Prey();
    } else {
        prey = null;
    }
    
    // 外敵の初期化
    hunters = [];
    if (simulationMode === 'hunter') {
        for (let i = 0; i < params.hunterCount; i++) {
            hunters.push(new Hunter());
        }
    }
}

// メインループ
function draw() {
    const currentTime = millis();
    const deltaTime = (currentTime - lastTime) / timeStep;
    lastTime = currentTime;
    
    background(20, 25, 40);
    
    if (isRunning) {
        // ボイド同士の衝突判定とワープ処理
        for (let i = 0; i < boids.length; i++) {
            for (let j = i + 1; j < boids.length; j++) {
                if (boids[i].isCollidingWithBoid(boids[j])) {
                    // ランダムに一方をワープさせる
                    if (random() < 0.5) {
                        boids[i].warpToRandomPosition();
                    } else {
                        boids[j].warpToRandomPosition();
                    }
                }
            }
        }

        // ボイドと外敵の衝突判定
        if (simulationMode === 'hunter') {
            for (let i = boids.length - 1; i >= 0; i--) {
                for (let hunter of hunters) {
                    if (boids[i].isCollidingWith(hunter)) {
                        // 衝突したボイドを削除
                        boids.splice(i, 1);
                        // 新しいボイドを生成
                        let newBoid = new Boid();
                        newBoid.trail = []; // 明示的に軌跡を空にする
                        boids.push(newBoid);
                        break;
                    }
                }
            }

            // 外敵同士の衝突判定とワープ処理
            for (let i = 0; i < hunters.length; i++) {
                for (let j = i + 1; j < hunters.length; j++) {
                    if (hunters[i].isCollidingWithHunter(hunters[j])) {
                        // ランダムに一方をワープさせる
                        if (random() < 0.5) {
                            hunters[i].warpToRandomPosition();
                        } else {
                            hunters[j].warpToRandomPosition();
                        }
                    }
                }
            }
        }

        // ボイドの更新
        for (let boid of boids) {
            boid.flock(boids);
            
            // モード別の追加処理
            if (simulationMode === 'prey' && prey) {
                let preyForce = boid.seekPrey(prey.position);
                boid.acceleration.add(preyForce);
            } else if (simulationMode === 'hunter' && hunters.length > 0) {
                let escapeForce = boid.escapeFromHunters(hunters);
                boid.acceleration.add(escapeForce);
            }
            
            boid.update(deltaTime);  // デルタタイムを渡す
        }
        
        // 餌の更新
        if (prey) {
            prey.update(deltaTime);  // デルタタイムを渡す
        }
        
        // 外敵の更新
        for (let hunter of hunters) {
            hunter.update(boids, deltaTime);  // デルタタイムを渡す
        }
    }
    
    // 描画
    for (let boid of boids) {
        boid.show();
    }
    
    if (prey) {
        prey.show();
    }
    
    for (let hunter of hunters) {
        hunter.show();
    }
    
    // 情報表示
    displayInfo();
}

// 情報表示
function displayInfo() {
    fill(255, 200);
    /*
    textSize(12);
    text(`ボイド数: ${boids.length}`, 10, 20);
    text(`モード: ${getModeName()}`, 10, 35);
    text(`FPS: ${Math.round(frameRate())}`, 10, 50);
    
    if (simulationMode === 'prey' && prey) {
        text(`餌位置: (${Math.round(prey.position.x)}, ${Math.round(prey.position.y)})`, 10, 65);
    } else if (simulationMode === 'hunter') {
        text(`外敵数: ${hunters.length}`, 10, 65);
    }
    */
}

function getModeName() {
    switch(simulationMode) {
        case 'basic': return '基本ボイドモデル';
        case 'prey': return '餌ありモデル';
        case 'hunter': return '外敵ありモデル';
        default: return '不明';
    }
}

// UIセットアップ
function setupUI() {
    // パラメータスライダーの設定
    setupSliders();
    
    // ボタンイベント
    document.getElementById('playPauseBtn').addEventListener('click', toggleSimulation);
    document.getElementById('resetBtn').addEventListener('click', resetSimulation);
    
    // モード選択
    document.getElementById('simulationMode').addEventListener('change', changeSimulationMode);
    
    // プリセット選択
    document.getElementById('presetSelect').addEventListener('change', applyPreset);
}

// スライダーセットアップ
function setupSliders() {
    const sliders = [
        'agentCount', 'minVel', 'maxVel',
        'cohesionForce', 'cohesionDistance', 'cohesionAngle',
        'separationForce', 'separationDistance', 'separationAngle', 'separationSpeedForce', 'separationSpeedDistance',
        'alignmentForce', 'alignmentDistance', 'alignmentAngle',
        'preyForce', 'preyMovementStep',
        'hunterCount', 'hunterForce', 'escapeForce', 'hunterSpeed'
    ];
    
    sliders.forEach(param => {
        const slider = document.getElementById(param);
        const valueDisplay = document.getElementById(param + 'Value');
        
        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                let value = parseFloat(e.target.value);
                params[param] = value;
                
                // 表示値の更新
                if (param.includes('Angle')) {
                    valueDisplay.textContent = value === Math.PI ? 'π' : 
                                             value === Math.PI/2 ? 'π/2' : 
                                             value.toFixed(2);
                } else {
                    valueDisplay.textContent = value.toString();
                }
                
                // 特別な処理
                if (param === 'agentCount') {
                    initializeBoids();
                } else if (param === 'hunterCount' && simulationMode === 'hunter') {
                    hunters = [];
                    for (let i = 0; i < params.hunterCount; i++) {
                        hunters.push(new Hunter());
                    }
                }
            });
        }
    });
}

// シミュレーション制御
function toggleSimulation() {
    isRunning = !isRunning;
    const btn = document.getElementById('playPauseBtn');
    btn.textContent = isRunning ? '一時停止' : '再生';
}

function resetSimulation() {
    initializeBoids();
}

function changeSimulationMode() {
    const select = document.getElementById('simulationMode');
    simulationMode = select.value;
    
    // コントロールパネルの表示/非表示
    document.getElementById('preyControls').style.display = 
        simulationMode === 'prey' ? 'block' : 'none';
    document.getElementById('hunterControls').style.display = 
        simulationMode === 'hunter' ? 'block' : 'none';
    
    initializeBoids();
}

function applyPreset() {
    const select = document.getElementById('presetSelect');
    const presetName = select.value;
    const preset = presets[presetName];
    
    if (preset) {
        // パラメータを更新
        Object.assign(params, preset);
        
        // UIを更新
        Object.keys(preset).forEach(key => {
            const slider = document.getElementById(key);
            const valueDisplay = document.getElementById(key + 'Value');
            
            if (slider) {
                slider.value = preset[key];
                if (valueDisplay) {
                    if (key.includes('Angle')) {
                        valueDisplay.textContent = preset[key] === Math.PI ? 'π' : 
                                                 preset[key] === Math.PI/2 ? 'π/2' : 
                                                 preset[key].toFixed(2);
                    } else {
                        valueDisplay.textContent = preset[key].toString();
                    }
                }
            }
        });
    }
}

// ウィンドウリサイズ対応
function windowResized() {
    let container = document.getElementById('canvas-container');
    canvasWidth = container.offsetWidth;
    canvasHeight = container.offsetHeight;
    resizeCanvas(canvasWidth, canvasHeight);
}



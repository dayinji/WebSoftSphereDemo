precision highp float;

attribute vec2 uv;
attribute vec3 position;
attribute vec3 normal;

uniform float time;
uniform vec3 pos;
uniform float radius;
uniform vec3 lightPosition;
uniform vec3 cutPoints[47];
uniform vec3 cutNormals[47];
uniform float cutRange[47];
uniform float roundRadiusFactor;
uniform float collisionFactor;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition; 
varying vec3 vLightPosition;

const float gap = 1.0;

float mapClamp(float v, float omin, float omax, float tmin, float tmax) {
	float res = tmin + (v - omin) / (omax - omin) * (tmax - tmin);
	return min(tmax, max(tmin, res));
}
void main() {
	vUv = uv;
	vNormal = normal;

	vPosition = pos + normalize(position)*radius;
	vLightPosition = lightPosition;

	float roundRadius = radius/6.0;
	roundRadius = min(roundRadius, 50.0) * roundRadiusFactor;

	// 循环处理47个碰撞信息
	for (int i = 0 ; i < 47 ; i++) {
		vec3 origin = cutPoints[i];
		vec3 cutnormal = cutNormals[i];
		float range = cutRange[i];
		
		if (range <= 0.0) continue;

		// 计算横截面坐标系的基
		vec3 unitZ = vec3(0.0, 0.0, 1.0);
		vec3 unitY = cutnormal;
		vec3 unitX = cross(unitZ, unitY);

		// 从世界坐标系的坐标（vPosition）转换成横截面坐标系坐标（tPosition）
		float x = dot(vPosition - origin, unitX);
		float y = dot(vPosition - origin, unitY);
		float z = vPosition.z;
		// tPosition为顶点在横截面坐标系下的坐标表示
		vec3 tPosition = vec3(x, y, z);

		// cutY：横截面位置，本应该是0，这里考虑到保持球与球碰撞面有间隔gap，因此cutY在0和gap之间，根据接触面大小过度。
		float cutY = gap*mapClamp(range, 0.0, 100.0, 0.0, 1.0);
		if (tPosition.y < cutY) {
			tPosition.y = mix(tPosition.y, cutY, collisionFactor);
		}

		// 计算圆角
		if (collisionFactor == 1.0) {
			float d = max(0.0, roundRadius - tPosition.y);
			float offset = roundRadius - sqrt(roundRadius*roundRadius - d*d);
			vec2 tCenter = vec2(0.0, 0.0);
			float distToOrigin = length(tCenter - tPosition.xz);
			float factor = min(1.0, max(0.0, distToOrigin / (range - roundRadius)));
			// XZ往中心缩，形成圆角
			vec2 newXZ = tPosition.xz + normalize(tCenter - tPosition.xz) * offset * factor;
			tPosition.xz = mix(tPosition.xz, newXZ, vec2(smoothstep(roundRadius, roundRadius*2.0, range)));
		}
		// 从横截面坐标系的坐标（tPosition）转换成世界坐标系坐标（vPosition）
		vPosition = origin + tPosition.x*unitX + tPosition.y*unitY + tPosition.z*unitZ;
	}
	gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
}
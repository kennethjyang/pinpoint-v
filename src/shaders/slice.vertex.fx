#version 300 es
precision highp float;

// Input clip-space position.
in vec2 position;

// Output UV coordinate for fragment shader.
out vec2 vUV;

void main(void) {
    // Convert clip space to UV.
    vUV = position * 0.5 + 0.5;

    // Place vertex on quad.
    gl_Position = vec4(position, 0.0, 1.0);
}
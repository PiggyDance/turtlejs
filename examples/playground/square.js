// Simple Square
// This example draws a colorful square with the turtle

// Set up the drawing
await t.penup();
await t.goto(-100, -100);
await t.pendown();
await t.pensize(5);
await t.pencolor("blue");

// Draw the square
await t.begin_fill();
await t.fillcolor("lightblue");
for (let i = 0; i < 4; i++) {
    await t.forward(200);
    await t.right(90);
}
await t.end_fill();

// Return to center
await t.penup();
await t.goto(0, 0);
await t.pendown();
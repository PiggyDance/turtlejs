// Five-pointed Star
// This example draws a colorful star with the turtle

// Set up the drawing
await t.penup();
await t.goto(-100, 50);
await t.pendown();
await t.pensize(3);
await t.pencolor("purple");

// Draw the star
await t.begin_fill();
await t.fillcolor("gold");
for (let i = 0; i < 5; i++) {
    await t.forward(200);
    await t.right(144);
}
await t.end_fill();

// Add a small signature
await t.penup();
await t.goto(0, -150);
await t.pencolor("black");
await t.write("TurtleJS Star", false, "center", "14px Arial");
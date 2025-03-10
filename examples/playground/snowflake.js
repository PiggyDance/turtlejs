// Koch Snowflake Fractal
// This example draws a Koch snowflake fractal

// Helper function to draw one segment of the Koch curve
async function drawKoch(length, depth) {
    if (depth === 0) {
        await forward(length);
    } else {
        // Each segment is replaced with 4 smaller segments
        await drawKoch(length / 3, depth - 1);
        await left(60);
        await drawKoch(length / 3, depth - 1);
        await right(120);
        await drawKoch(length / 3, depth - 1);
        await left(60);
        await drawKoch(length / 3, depth - 1);
    }
}

// Set up the drawing
penup();
goto(-150, 100);
pendown();
speed(0);
pensize(2);
pencolor("teal");


// Draw the snowflake (three Koch curves)
begin_fill();
fillcolor("lightcyan");
for (let i = 0; i < 3; i++) {
    await drawKoch(300, 3);
    await right(120);
}
end_fill();

// Add a label
penup();
goto(0, 0);
pencolor("darkblue");
write("Koch Snowflake Fractal", false, "center", "16px Arial");
goto(0, 0);
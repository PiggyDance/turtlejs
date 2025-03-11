'use strict';

var tk_colors, hex_to_colors;

var defaults = {
    width : 0.5,               // Screen
    height : 0.75,
    canvwidth : 400,
    canvheight: 300,
    leftright: null,
    topbottom: null,
    mode: "standard",          // TurtleScreen
    colormode: 1.0,
    colormode_keep_names: false,
    delay: 10,
    undobuffersize: 1000,      // RawTurtle
    shape: "classic",
    pencolor : "black",
    fillcolor : "black",
    resizemode : "noresize",
    visible : true,
    x: 0,                       // Turtle defaults
    y: 0,
    angle: 0,
    isDown: true,
    drawSpeed: 1,
    penSize: 1,
    filling: false,
    fillRule: 'evenodd',
    tiltAngle: 0,
    turtleSize: 10,
    stretchFactors :{ width: 1, length: 1, outline: 1 },
    fullcircle: 360.0,
    maxUndoSteps: 10,
    shapes:{
        'turtle': [[0,16], [-2,14], [-1,10], [-4,7], [-7,9], [-9,8], [-6,5], [-7,1], [-5,-3], [-8,-6], 
                  [-6,-8], [-4,-5], [0,-7], [4,-5], [6,-8], [8,-6], [5,-3], [7,1], [6,5], [9,8], [7,9], 
                  [4,7], [1,10], [2,14]],
        'arrow': [[0,10], [-5,0], [5,0]],
        'circle': [...Array(36)].map((_, i) => {
            const angle = i * 10 * Math.PI / 180;
            return [Math.sin(angle) * 10, Math.cos(angle) * 10];
        }),
        'square': [[10,10], [10,-10], [-10,-10], [-10,10]],
        'triangle': [[0,10], [-10,-10], [10,-10]],
        'classic': [[0,0], [-5,-9], [0,-7], [5,-9]]
    },
    imageRendering: 'pixelated',
    imageSmoothing: false,
    imageSmoothingQuality: 'low'
};

// Convert special key names to match JavaScript events
const keyMap = {
    'space': ' ',
    'return': 'Enter',
    'tab': 'Tab',
    'backspace': 'Backspace',
    'delete': 'Delete',
    'escape': 'Escape',
    'up': 'ArrowUp',
    'down': 'ArrowDown',
    'left': 'ArrowLeft',
    'right': 'ArrowRight'
};

class Turtle {
    #delay = 0;
    #canvas;
    #ctx;
    #x;
    #y;
    #angle;
    #isDown;
    #drawSpeed;
    #color;
    #penSize;
    #isVisible;
    #turtleSize; // Size of the turtle cursor
    #lastDrawnTurtleState = null;  // Add this to class fields
    #shapes = {
        'turtle': [[0,16], [-2,14], [-1,10], [-4,7], [-7,9], [-9,8], [-6,5], [-7,1], [-5,-3], [-8,-6], 
                  [-6,-8], [-4,-5], [0,-7], [4,-5], [6,-8], [8,-6], [5,-3], [7,1], [6,5], [9,8], [7,9], 
                  [4,7], [1,10], [2,14]],
        'arrow': [[0,10], [-5,0], [5,0]],
        'circle': [...Array(36)].map((_, i) => {
            const angle = i * 10 * Math.PI / 180;
            return [Math.sin(angle) * 10, Math.cos(angle) * 10];
        }),
        'square': [[10,10], [10,-10], [-10,-10], [-10,10]],
        'triangle': [[0,10], [-10,-10], [10,-10]],
        'classic': [[0,0], [-5,-9], [0,-7], [5,-9]]
    };
    #currentShape;
    #filling;
    #fillPath = null;
    #fillcolor;
    #stampIds = 1;
    #stamps = new Map();
    #tiltAngle;
    #mode;
    #undoBuffer = [];
    #maxUndoSteps;
    #resizeMode;
    #stretchFactors;
    #keyHandlers = new Map();
    #currentAnimationPromise = Promise.resolve();
    #fullcircle;  // Add this property declaration
    #imageSmoothing = false;
    #imageSmoothingQuality = 'low';
    #screen;  // Add screen reference
    #undobuffersize;
    #pathBuffer = []; // Add this to store Path2D objects
    #needsUpdate = false; // Flag to indicate when screen needs redrawing
    #worldCoordinates;
    #polyPoints = null;
    #currentPoly = null;

    imageSmoothing(smoothing=null) {
        if (smoothing === null) return this.#imageSmoothing;
        this.#imageSmoothing = smoothing;
    }

    imageSmoothingQuality(quality=null) {
        if (quality === null) return this.#imageSmoothingQuality;
        if (['low', 'medium', 'high'].includes(quality)) {
            this.#imageSmoothingQuality = quality;
        } else {
            throw new Error("imageSmoothingQuality() expects 'low', 'medium', or 'high'");
        }
    }

    get #colormode() {
        return this.#screen.colormode();
    }

    #col_user(color) { 
        return this.#screen._user_color(color);
    }

    #col_arg(color) {
        return this.#screen._color_arg_normalize(color);
    }

    constructor(canvasOrScreenOrTurtle, config = defaults) {
        // Handle either Screen instance or canvas element
        if (canvasOrScreenOrTurtle instanceof Screen) {
            this.#screen = canvasOrScreenOrTurtle;
            this.#canvas = canvasOrScreenOrTurtle.getcanvas();
        } else if (canvasOrScreenOrTurtle instanceof Turtle) {
            this.#screen = canvasOrScreenOrTurtle.getscreen();
            this.#canvas = this.#screen.getcanvas();
            config = canvasOrScreenOrTurtle._getstate();
        } else {
            // Create new Screen if canvas provided
            this.#screen = new Screen(canvasOrScreenOrTurtle);
            this.#canvas = canvasOrScreenOrTurtle;
        }
        
        // Add this turtle to screen's turtle collection
        this.#screen.addTurtle(this);
        
        this.#ctx = this.#canvas.getContext('2d', { willReadFrequently: true });
        this.#ctx.imageSmoothingEnabled = this.#imageSmoothing;
        this.#ctx.imageSmoothingQuality = this.#imageSmoothingQuality;
        
        // Initialize other properties
        this._setstate(config);

        this.#worldCoordinates = this.#screen.getWorldCoordinates();
        
        // Draw the initial turtle
        this.#drawTurtle();
    }

    // Add this helper method to queue any operation
    async #queueOperation(operation) {
        this.#currentAnimationPromise = this.#currentAnimationPromise.then(() => {
            return new Promise(async resolve => {
                let res = await operation();
                resolve(res);
            });
        });
        return this.#currentAnimationPromise;
    }

    // Convert world coordinates to screen coordinates
    #worldToScreen(x, y) {
        return this.#screen._worldToScreen(x, y);
    }

    // Convert screen coordinates to world coordinates
    #screenToWorld(x, y) {
        return this.#screen._screenToWorld(x, y);
    }

    // Screen methods
    async screensize(width=null, height=null, bgColor=null) {
        return this.#queueOperation(() => {
            if (width !== null && height !== null) {
                this.#canvas.width = width;
                this.#canvas.height = height;
            }
            
            if (bgColor !== null) {
                this.#canvas.style.backgroundColor = this.#col_arg(bgColor);
            }
            
            return [this.#canvas.width, this.#canvas.height];
        });
    }

    async begin_poly() {
        return this.#queueOperation(() => {
            // Start recording the vertices of a polygon
            this.#polyPoints = [];
            // Add current position as the first vertex
            this.#polyPoints.push([this.#x, this.#y]);
            return Promise.resolve();
        });
    }

    async end_poly() {
        return this.#queueOperation(() => {
            // Stop recording the vertices of a polygon
            if (!this.#polyPoints) {
                throw new Error("end_poly() without matching begin_poly()");
            }

            // Add the current position as the last vertex
            this.#polyPoints.push([this.#x, this.#y]);

            // Save the completed polygon
            this.#currentPoly = [...this.#polyPoints];

            // Reset the recording points array
            this.#polyPoints = null;

            return Promise.resolve();
        });
    }

    async get_poly() {
        return this.#queueOperation(() => {
            // Return the last recorded polygon
            if (!this.#currentPoly) {
                throw new Error("No polygon has been recorded yet. Use begin_poly() and end_poly() first.");
            }

            return [...this.#currentPoly];
        });
    }

    async resizemode(rmode=null) {
        if (!["noresize", "auto", "user"].includes(rmode)) {
            throw new Error("resizemode() expects 'noresize', 'auto', or 'user'");
        }
        return this.#queueOperation(() => {
            if (rmode === null) {
                return this.#resizeMode;
            }
            if (this.#resizeMode === rmode) {
                this.#clearTurtle();
                this.#resizeMode = rmode;
                this.#drawTurtle();
            }
            this.#resizeMode = rmode;
            return this.#resizeMode;
        });
    }

    async setundobuffer(size=null) {
        return this.#queueOperation(() => {
            if (size !== null) {
                this.#undobuffersize = size;
            } else {
                this.#undobuffersize = 0;
            }
            return this.#undobuffersize;
        });
    }

    async setworldcoordinates(left, bottom, right, top) {
        return this.#queueOperation(() => {
            this.#screen.setworldcoordinates(left, bottom, right, top);
        });
    }

    _setworldcoordinates(/*left, bottom, right, top*/) {
        const wasVisible = this.#isVisible;
        this.#isVisible = false;
        this.#clearTurtle();

        if (!this.#worldcoordIsEqual(this.#screen.getWorldCoordinates(), this.#worldCoordinates)) {
            this._clear(false);
            this._pensize(this.#penSize);
            this.#needsUpdate = true;
            this.#worldCoordinates = this.#screen.getWorldCoordinates();
            this._update();
        }

        this.#isVisible = wasVisible;
        
        if (wasVisible) {
            this.#drawTurtle();
        }
    }

    // Update existing methods to use the new coordinate system
    #clearTurtle() {
        if (this.#lastDrawnTurtleState) {
            this.#ctx.putImageData(
                this.#lastDrawnTurtleState.imageData,
                this.#lastDrawnTurtleState.x,
                this.#lastDrawnTurtleState.y
            );
        }
        this.#lastDrawnTurtleState = null;
    }

    async forward(distance) {
        return this.#queueOperation(async () => {
            await this._forward(distance);
        });
    }

    async _forward(distance) {
        this.#clearTurtle();
        const state = this.#saveState('forward', [distance]);
        
        const startX = this.#x;
        const startY = this.#y;
        const startTime = performance.now();
        const radians = (this.#angle * Math.PI) / 180;
        
        const duration = this.#drawSpeed === 0 ? 0 : (11 - this.#drawSpeed) * 50;
        
        // Initialize the path with the starting point if pen is down
        this.#addPointToState(state, startX, startY);
        
        const animate = (currentTime) => {
            this.#clearTurtle();
            
            const elapsed = currentTime - startTime;
            const progress = Math.max(0, Math.min(elapsed / duration, 1));
            
            const prevX = this.#x;
            const prevY = this.#y;

            // Calculate current position in world coordinates
            this.#x = startX + (distance * Math.cos(radians) * progress);
            this.#y = startY + (distance * Math.sin(radians) * progress);

            // Draw line if pen is down
            if (this.#isDown) {
                // Convert world coordinates to screen coordinates
                const [screenStartX, screenStartY] = this.#worldToScreen(prevX, prevY);
                const [screenEndX, screenEndY] = this.#worldToScreen(this.#x, this.#y);
                
                this.#ctx.beginPath();
                this.#ctx.moveTo(screenStartX, screenStartY);
                this.#ctx.lineTo(screenEndX, screenEndY);
                this.#ctx.stroke();
            }
            
            this.#drawTurtle();
        };

        if (this.#drawSpeed < 10) {
            // Start animation
            let that = this;
            return new Promise(resolve => {
                requestAnimationFrame(function animateWrapper(currentTime) {
                    animate(currentTime);
                    if (currentTime - startTime >= duration) {
                        that.#addPointToState(state, that.#x, that.#y);
                        that.#polyPoints && that.#polyPoints.push([that.#x, that.#y]);
                        resolve();
                    } else {
                        requestAnimationFrame(animateWrapper);
                    }
                });
            });
        } else {
            // Instant movement for maximum speed
            this.#x = startX + (distance * Math.cos(radians));
            this.#y = startY + (distance * Math.sin(radians));
            if (this.#isDown) {
                const [screenStartX, screenStartY] = this.#worldToScreen(startX, startY);
                const [screenEndX, screenEndY] = this.#worldToScreen(this.#x, this.#y);
                
                this.#ctx.beginPath();
                this.#ctx.moveTo(screenStartX, screenStartY);
                this.#ctx.lineTo(screenEndX, screenEndY);
                this.#ctx.stroke();

            } 
            this.#addPointToState(state, this.#x, this.#y);
            this.#polyPoints && this.#polyPoints.push([this.#x, this.#y]);
            
            this.#drawTurtle();
        }
    }

    // Add a method to get the current world coordinates
    getworld() {
        return {...this.#worldCoordinates};
    }

    async backward(distance) {
        return this.forward(-distance);
    }

    async right(angle) {
        return this.#queueOperation(async () => {
            await this._right(angle);
        });
    }

    async _right(angle) {
        let that = this;
        this.#clearTurtle();
        let state = this.#saveState('right', [angle]);
        
        const startAngle = this.#angle;
        const startTime = performance.now();
        
        // Calculate duration based on speed
        const duration = this.#drawSpeed === 0 ? 0 : (11 - this.#drawSpeed) * 50;

        // Animation frame function
        const animate = (currentTime) => {
            // Clear turtle at start of each frame
            this.#clearTurtle();
            
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Calculate current angle - negate the angle for right turns
            this.#angle = startAngle - (angle * progress);
            
            this.#drawTurtle();
        };

        if (this.#drawSpeed < 10) {
            // Start animation
            return new Promise(resolve => {
                requestAnimationFrame(function animateWrapper(currentTime) {
                    animate(currentTime);
                    if (currentTime - startTime >= duration) {
                        that.#updateState(state);
                        resolve();
                    } else {
                        requestAnimationFrame(animateWrapper);
                    }
                });
            });
        } else {
            // Instant rotation for maximum speed
            this.#angle = startAngle - angle;
            this.#updateState(state);
            this.#drawTurtle();
        }
    }

    async left(angle) {
        return this.right(-angle);
    }

    // Modify penup to be async
    async penup() {
        return this.#queueOperation(() => {
            this.#isDown = false;
            this.#saveState('penup', []);
        });
    }

    // Modify pendown to be async
    async pendown() {
        return this.#queueOperation(() => {
            this.#isDown = true;
            this.#saveState('pendown', []);
        });
    }

    async color(...color) {
        return this.#queueOperation(() => {
            return this._color(...color);
        });
    }

    _color(...color) {
        if (color.length == 0) {
            return [this.#color, this.#fillcolor].map(c => this.#col_user(c));
        }

        this.#clearTurtle();
        let pen_color, fill_color;

        if (color.length == 3) {
            fill_color = pen_color = this.#col_arg(color);
        }
        else if (color.length == 2) {
            pen_color = this.#col_arg(color[0]);
            fill_color = this.#col_arg(color[1]);
        }
        else if (color.length == 1) {
                pen_color = fill_color = this.#col_arg(color[0]);
        }
        this.#color = pen_color;
        this.#fillcolor = fill_color;
        this.#ctx.strokeStyle = pen_color;
        this.#saveState('color', color);
        this.#drawTurtle();
        
    }

    async pensize(width=null) {
        return this.#queueOperation(() => {
            this._pensize(width);
        });
    }

    async width(_width=null) {return await this.pensize(_width);}

    _pensize(width=null) {
        if (width == null) {
            return this.#penSize;
        }
        this.#penSize = width;
            
        if (this.#resizeMode === "noresize") {
            const scaleX = this.#canvas.width / (this.#worldCoordinates.right - this.#worldCoordinates.left);
            const scaleY = this.#canvas.height / (this.#worldCoordinates.top - this.#worldCoordinates.bottom);
            const scaleFactor = (Math.abs(scaleX) + Math.abs(scaleY))/2.0;
            this.#ctx.lineWidth = width / scaleFactor;
        } else {
            this.#ctx.lineWidth = width;
        }
        this.#saveState('pensize', [width]);
    }

    async clear() {
        return this.#queueOperation(() => {
            this._clear();
        });
    }

    _clear(saveState=true) {
        this.#clearTurtle();
        this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
        if (this.#isVisible) {
            this.#drawTurtle();
        }
        if (saveState) {
            this.#saveState('clear', []);
        }
    }


    async home() {
        return this.#queueOperation(() => {
            this._home();
        });
    }

    _home() {
        this.#x = 0;
        this.#y = 0;
        this.#angle = 0;
        this.#saveState('home', []);
    }

    async goto(x, y=null) {
        return this.#queueOperation(async () => {
            await this._goto(x, y);
        });
    }

    async teleport(x, y=null, fill_gap=false) {
        return this.#queueOperation(async () => {
            this._teleport(x, y, fill_gap);
        });
    }

    async _teleport(x, y=null, fill_gap=false) {
        if (y === null) {
            if (Array.isArray(x)) {
                [x, y] = x;
            } else {
                throw new Error("If only one argument is provided, it must be a [x,y] array");
            }
        }

        this.#clearTurtle();
        this.#x = x;
        this.#y = y;
        this.#saveState('teleport', [x, y]);

        if (this.#isDown && fill_gap) {
            const [screenX, screenY] = this.#worldToScreen(this.#x, this.#y);
            this.#ctx.beginPath();
            this.#ctx.arc(screenX, screenY, this.#penSize / 2, 0, Math.PI * 2);
            this.#ctx.fillStyle = this.#col_arg(this.#color);
            this.#ctx.fill();
        }

        if (this.#isVisible) {
            this.#drawTurtle();
        }
    }

    async _goto(x, y) {
        let that = this;
        this.#clearTurtle();
        const state = this.#saveState('goto', [x, y]);
        
        const startX = this.#x;
        const startY = this.#y;
        
        this.#addPointToState(state, x, y);
        
        const startTime = performance.now();
        const duration = this.#drawSpeed === 0 ? 0 : (11 - this.#drawSpeed) * 50;
        
        const animate = (currentTime) => {
            this.#clearTurtle();
            
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Calculate current position
            this.#x = startX + (x - startX) * progress;
            this.#y = startY + (y - startY) * progress;

            // Draw line if pen is down
            if (this.#isDown) {
                const [screenStartX, screenStartY] = this.#worldToScreen(startX, startY);
                const [screenEndX, screenEndY] = this.#worldToScreen(this.#x, this.#y);
                
                this.#ctx.beginPath();
                this.#ctx.moveTo(screenStartX, screenStartY);
                this.#ctx.lineTo(screenEndX, screenEndY);
                this.#ctx.stroke();

            }
            
            this.#drawTurtle();
        };

        if (this.#drawSpeed < 10) {
            return new Promise(resolve => {
                requestAnimationFrame(function animateWrapper(currentTime) {
                    animate(currentTime);
                    if (currentTime - startTime >= duration) {
                        that.#addPointToState(state, that.#x, that.#y);
                        that.#polyPoints && that.#polyPoints.push([that.#x, that.#y]);
                        resolve();
                    } else {
                        requestAnimationFrame(animateWrapper);
                    }
                });
            });
        } else {
            // Instant movement for maximum speed
            this.#x = x;
            this.#y = y;
            if (this.#isDown) {
                const [screenStartX, screenStartY] = this.#worldToScreen(startX, startY);
                const [screenEndX, screenEndY] = this.#worldToScreen(this.#x, this.#y);
                
                this.#ctx.beginPath();
                this.#ctx.moveTo(screenStartX, screenStartY);
                this.#ctx.lineTo(screenEndX, screenEndY);
                this.#ctx.stroke();

            }

            this.#addPointToState(state, this.#x, this.#y);
            this.#polyPoints && this.#polyPoints.push([this.#x, this.#y]);
            
            this.#drawTurtle();
        }
        return Promise.resolve();
    }

    async setheading(angle) {
        return this.#queueOperation(() => {
            this._setheading(angle);
        });
    }

    // Aliases for goto
    async setpos(x, y=null) { return this.goto(x, y); }
    async setposition(x, y=null) { return this.goto(x, y); }

    // Aliases to match Python's turtle module
    async fd(distance) { return this.forward(distance); }
    async bk(distance) { return this.backward(distance); }
    async back(distance) { return this.backward(distance); }
    async rt(angle) { return this.right(angle); }
    async lt(angle) { return this.left(angle); }
    async seth(angle) { return this.setheading(angle); }
    async pu() { return this.penup(); }
    async pd() { return this.pendown(); }
    async down() { return this.pendown(); }
    async up() { return this.penup(); }

    // Position getters
    async position() {
        return this.#queueOperation(() => {
            return [this.#x, this.#y];
        });
    }
    
    async pos() {
        return this.position();
    }
    
    async xcor() {
        return this.#queueOperation(() => {
            return this.#x;
        });
    }
    
    async ycor() {
        return this.#queueOperation(() => {
            return this.#y;
        });
    }
    
    // Heading getters
    async heading() {
        return this.#queueOperation(() => {
            return this.#angle;
        });
    }
    
    async towards(x, y=null) {
        return this.#queueOperation(() => {
            let toX, toY;
            if (y === null) {
                if (Array.isArray(x)) {
                    [toX, toY] = x;
                } else {
                    throw new Error("If only one argument is provided, it must be a [x,y] array");
                }
            } else {
                toX = x;
                toY = y;
            }
            
            const dx = toX - this.#x;
            const dy = toY - this.#y;
            return ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
        });
    }

    #drawShape(shape, scale = 1, angle = 0) {
        const shapePoints = this.#screen.getShape(shape);
        if (!shapePoints) return;

        // Convert turtle position to screen coordinates
        const [screenX, screenY] = this.#worldToScreen(this.#x, this.#y);
        
        // Start a new path
        this.#ctx.beginPath();
        
        // Transform shape points
        const transformedShape = shapePoints.map(([x, y]) => {
            // Scale the point
            const scaledX = x * scale * this.#stretchFactors.width;
            const scaledY = y * scale * this.#stretchFactors.length;
            
            // Rotate the point
            const rotationRad = (-this.#angle - 90) * Math.PI / 180;
            const rotatedX = scaledX * Math.cos(rotationRad) - scaledY * Math.sin(rotationRad);
            const rotatedY = scaledX * Math.sin(rotationRad) + scaledY * Math.cos(rotationRad);
            
            // Return screen coordinates
            return [
                screenX + rotatedX,
                screenY + rotatedY
            ];
        });
        
        // Draw the transformed shape
        this.#ctx.moveTo(transformedShape[0][0], transformedShape[0][1]);
        for (const [x, y] of transformedShape.slice(1)) {
            this.#ctx.lineTo(x, y);
        }
        this.#ctx.closePath();

        // Fill and stroke the shape
        this.#ctx.fillStyle = this.#color;
        this.#ctx.fill();
        this.#ctx.strokeStyle = this.#color;
        this.#ctx.stroke();
    }


    #drawTurtle(is_stamp=false) {
        if (!this.#isVisible && !is_stamp) return;

        this.#clearTurtle();

        // Calculate screen coordinates for the turtle
        const [screenX, screenY] = this.#worldToScreen(this.#x, this.#y);
        
        // Calculate scaling factors
        const scaleX = this.#canvas.width / (this.#worldCoordinates.right - this.#worldCoordinates.left);
        const scaleY = this.#canvas.height / (this.#worldCoordinates.top - this.#worldCoordinates.bottom);
        
        // Increase the margin to ensure we capture the entire turtle
        // and scale it according to the coordinate system
        const margin = (this.#turtleSize + this.#penSize) * Math.max(scaleX, scaleY) * 2;
        const size = margin * 2;
        
        // Save the area where we'll draw the turtle
        if (!is_stamp) {
            this.#lastDrawnTurtleState = {
                imageData: this.#ctx.getImageData(
                    screenX - margin, 
                    screenY - margin, 
                    size, 
                    size
                ),
                x: screenX - margin,
                y: screenY - margin
            };
        }

        // Draw the turtle
        this.#drawShape(this.#currentShape, 1, this.#angle);
    }

    // Visibility methods
    async hideturtle() {
        return this.#queueOperation(() => {
            this.#clearTurtle();
            this.#isVisible = false;
        });
    }
    
    async showturtle() {
        return this.#queueOperation(() => {
            this.#isVisible = true;
            this.#drawTurtle();
        });
    }
    
    async isvisible() {
        return this.#queueOperation(() => {
            return this.#isVisible;
        });
    }
    
    // Aliases
    async ht() { return this.hideturtle(); }
    async st() { return this.showturtle(); }

    #saveState(action, parameters = []) {
        // Create a state object without the full canvas image data
        const state = {
            x: this.#x,
            y: this.#y,
            angle: this.#angle,
            isDown: this.#isDown,
            color: this.#color,
            penSize: this.#penSize,
            isVisible: this.#isVisible,
            worldCoordinates: { ...this.#worldCoordinates },
            resizeMode: this.#resizeMode,
            stretchFactors: { ...this.#stretchFactors },
            path: null, // Will store Path2D for drawing operations
            action: action, // Store the function name
            parameters: parameters, // Store the parameters
            filling: this.#filling, // Track if we're in filling mode
            fillColor: this.#fillcolor, // Store the fill color
            fillPath: this.#filling && this.#fillPath ? new Path2D(this.#fillPath) : null, // Create a COPY of the fill path
            points: []
        };

        this.#undoBuffer.push(state);
        
        // Limit undo buffer size
        if (this.#undoBuffer.length > this.#undobuffersize) {
            // If we're exceeding buffer size, create a snapshot of current drawing
            const firstItem = this.#undoBuffer.shift();
            
            // If the first item had a path that we're removing, we need to 
            // incorporate it into our base drawing
            if (firstItem.path || firstItem.fillPath) {
                // Create a snapshot if we don't have one yet
                if (this.#pathBuffer.length === 0) {
                    this.#pathBuffer.push({
                        type: 'snapshot',
                        imageData: this.#ctx.getImageData(0, 0, this.#canvas.width, this.#canvas.height)
                    });
                }
            }
        }
        
        return state; // Return the state for operations to add path data
    }

    #restoreState(state) {
        this.#lastDrawnTurtleState = null;
        this.#x = state.x;
        this.#y = state.y;
        this.#angle = state.angle;
        this.#isDown = state.isDown;
        this.#color = state.color;
        this.#penSize = state.penSize;
        this.#isVisible = state.isVisible;
        this.#worldCoordinates = { ...state.worldCoordinates };
        this.#resizeMode = state.resizeMode;
        this.#stretchFactors = { ...state.stretchFactors };

        // Restore canvas state
        if (state.canvasState) {
            this.#ctx.putImageData(state.canvasState, 0, 0);
        }

        // Update visual properties
        this.#ctx.strokeStyle = this.#color;
        this._pensize(this.#penSize);
        
        // Redraw turtle if visible
        if (this.#isVisible) {
            this.#drawTurtle();
        }
    }

    async setx(x) {
        return this.#queueOperation(() => {
            this.goto(x, this.#y);
        });
    }

    async sety(y) {
        return this.#queueOperation(() => {
            this.goto(this.#x, y);
        });
    }

    async distance(x, y=null) {
        return this.#queueOperation(() => {
            let toX, toY;
            if (y === null) {
                if (Array.isArray(x)) {
                    [toX, toY] = x;
                } else {
                    throw new Error("If only one argument is provided, it must be a [x,y] array");
                }
            } else {
                toX = x;
                toY = y;
            }
            return Math.sqrt((this.#x - toX)**2 + (this.#y - toY)**2);
        });
    }

    onclick(fun, btn=1, add=null) {
        let that = this;
        if (!fun) {
            // Remove all click handlers if fun is null/undefined
            this.#canvas.onclick = null;
            this.#canvas.onauxclick = null;
            return;
        }

        const handler = (event) => {
            // Get click coordinates relative to canvas
            const rect = that.#canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            // Convert screen coordinates to world coordinates
            const [worldX, worldY] = that.#screenToWorld(x, y);
            
            // Call the user function with world coordinates
            fun(worldX, worldY);
        };

        if (btn === 1) {
            // Left click
            if (add) {
                // Add new handler while preserving existing ones
                const oldHandler = this.#canvas.onclick;
                this.#canvas.onclick = (e) => {
                    if (oldHandler) oldHandler(e);
                    handler(e);
                };
            } else {
                // Replace existing handler
                this.#canvas.onclick = handler;
            }
        } else if (btn === 2) {
            // Middle click
            if (add) {
                const oldHandler = this.#canvas.onauxclick;
                this.#canvas.onauxclick = (e) => {
                    if (e.button === 1) {  // middle button is 1 in auxclick
                        if (oldHandler) oldHandler(e);
                        handler(e);
                    }
                };
            } else {
                this.#canvas.onauxclick = (e) => {
                    if (e.button === 1) handler(e);  // middle button is 1 in auxclick
                };
            }
        } else if (btn === 3) {
            // Right click
            if (add) {
                const oldHandler = this.#canvas.onauxclick;
                this.#canvas.onauxclick = (e) => {
                    if (e.button === 2) {  // right button is 2 in auxclick
                        if (oldHandler) oldHandler(e);
                        handler(e);
                    }
                };
            } else {
                this.#canvas.onauxclick = (e) => {
                    if (e.button === 2) handler(e);  // right button is 2 in auxclick
                };
            }
        }
    }

    // Add alias for onclick
    onscreenclick(fun, btn=1, add=null) {
        return this.onclick(fun, btn, add);
    }

    onkey(fun, key) {
        // If fun is null/undefined, remove the key binding
        if (fun === null) {
            if (key) {
                document.removeEventListener('keyup', this.#keyHandlers?.get(key));
                this.#keyHandlers?.delete(key);
            } else {
                for (const [key, handler] of this.#keyHandlers) {
                    document.removeEventListener('keyup', handler);
                }
                this.#keyHandlers.clear();
            }
            return;
        }

        // Normalize the key
        const normalizedKey = keyMap[key.toLowerCase()] || key.toLowerCase();

        // Create handler function
        const handler = (event) => {
            if (event.key.toLowerCase() === normalizedKey.toLowerCase()) {
                fun();
            }
        };

        // Store handler for potential later removal
        this.#keyHandlers.set(key, handler);

        // Add event listener
        document.addEventListener('keyup', handler);
    }

    // Alias for onkey
    onkeyrelease(fun, key) {
        return this.onkey(fun, key);
    }

    onkeypress(fun, key=null) {
        // If fun is null/undefined, remove the key binding
        if (fun === null) {
            this.onkey(null, key);
            return;
        }

        // Normalize the key
        const normalizedKey = keyMap[key.toLowerCase()] || key.toLowerCase();

        // Create handler function
        const handler = (event) => {
            if (event.key.toLowerCase() === normalizedKey.toLowerCase()) {
                fun();
            }
        };

        // Store handler for potential later removal
        this.#keyHandlers.set(key, handler);

        // Add event listener
        document.addEventListener('keydown', handler);
    }

    world_width() {
        return this.#worldCoordinates.right - this.#worldCoordinates.left;
    }

    world_height() {
        return this.#worldCoordinates.top - this.#worldCoordinates.bottom;
    }

    window_width() {
        return this.#canvas.width;
    }

    window_height() {
        return this.#canvas.height;
    }

    async delay(ms=null) {
        return this.#queueOperation(() => {
            if (ms === null) return this.#delay;
            this.#delay = ms;
        });
    }

    async bgcolor(color) {
        return this.#queueOperation(() => {
            this.#canvas.style.backgroundColor = this.#col_arg(color);
        });
    }

    async shape(name=null) {
        return this.#queueOperation(() => {
            if (name === null) return this.#currentShape;
            if (this.#screen.getShape(name)) {
                this.#currentShape = name;
                this.#drawTurtle();
            } else {
                throw new Error(`Shape ${name} is not available`);
            }
        });
    }

    async shapesize(stretch_wid=null, stretch_len=null, outline=null) {
        return this.#queueOperation(() => {
            if (stretch_wid !== null && stretch_len !== null) {
                this.#stretchFactors.width = stretch_wid;
                this.#stretchFactors.length = stretch_len;
            }
            if (outline !== null) {
                this.#stretchFactors.outline = outline;
            }
        });
    }

    async turtlesize(stretch_wid=null, stretch_len=null, outline=null) {
        return await this.shapesize(stretch_wid, stretch_len, outline);
    }

    async circle(radius, extent=360, steps=null) {
        return this.#queueOperation(async () => {
            await this._circle(radius, extent, steps);
        });
    }

    async _circle(radius, extent=360, steps=null) {
        this.#clearTurtle();
        const state = this.#saveState('circle', [radius, extent, steps]);
        const segments_per_circle = 100;
        
        // Calculate number of steps if not provided
        if (steps === null) {
            steps = Math.max(4, Math.floor(Math.abs(radius) / 5));
        }

        // Calculate circle center based on current position and heading
        const radians = (this.#angle - 90) * Math.PI / 180;
        const centerX = this.#x - Math.abs(radius) * Math.cos(radians);
        const centerY = this.#y - Math.abs(radius) * Math.sin(radians);
        
        const startAngle = radians;  // Start from current direction
        const counterClockwise = radius < 0;
        
        // Create a Path2D for this circle if pen is down
        if (this.#isDown) {
            // Number of segments for smooth curve:
            const segments = Math.max(2, Math.ceil(segments_per_circle * (Math.abs(extent) % 360) / 360));  
            const points = [];
            
            // Add starting point
            points.push([this.#x, this.#y]);
            
            // Generate points along the circle
            for (let i = 1; i <= segments; i++) {
                const segmentAngle = startAngle + (extent * (i / segments) * Math.PI / 180);
                const x = centerX + Math.abs(radius) * Math.cos(segmentAngle);
                const y = centerY + Math.abs(radius) * Math.sin(segmentAngle);
                points.push([x, y]);
                this.#addPointToState(state, x, y, false, false);
                this.#polyPoints && this.#polyPoints.push([x, y]);
            }
            
            // Create path from points
            state.path = this.#createPathFromPoints(points);
            state.points = points;
        }
        
        const startTime = performance.now();
        const duration = this.#drawSpeed === 0 ? 0 : (11 - this.#drawSpeed) * 200;
        
        // Animation frame function
        const animate = (currentTime) => {
            this.#clearTurtle();

            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Calculate current extent and end angle
            const currentExtent = extent * progress;
            const currentEndAngle = startAngle + (currentExtent * Math.PI / 180);

            if (this.#isDown) {
                // Draw the circle segment using small line segments
                const segments = 100;  // Number of segments for smooth curve
                const progressSegments = Math.floor(segments * progress);

                for (let i = 0; i <= progressSegments; i++) {
                    const segmentAngle = startAngle + (extent * (i / segments) * Math.PI / 180);
                    const x = centerX + Math.abs(radius) * Math.cos(segmentAngle);
                    const y = centerY + Math.abs(radius) * Math.sin(segmentAngle);
                    const [screenX, screenY] = this.#worldToScreen(x, y);

                    if (i === 0) {
                        this.#ctx.beginPath();
                        this.#ctx.moveTo(screenX, screenY);
                    } else {
                        this.#ctx.lineTo(screenX, screenY);
                        this.#ctx.stroke();
                        this.#ctx.beginPath();
                        this.#ctx.moveTo(screenX, screenY);
                    }
                }
            }

            // Update turtle position
            this.#x = centerX + Math.abs(radius) * Math.cos(currentEndAngle);
            this.#y = centerY + Math.abs(radius) * Math.sin(currentEndAngle);

            // Update turtle angle to be tangent to the circle
            const tangentAngle = (currentEndAngle * 180 / Math.PI) + (counterClockwise ? -90 : 90);
            this.#angle = tangentAngle;

            this.#drawTurtle();
        };

        if (this.#drawSpeed < 10) {
            // Start animation
            return new Promise(resolve => {
                requestAnimationFrame(function animateWrapper(currentTime) {
                    animate(currentTime);
                    if (currentTime - startTime >= duration) {
                        resolve();
                    } else {
                        requestAnimationFrame(animateWrapper);
                    }
                });
            });
        } else {
            // Instant drawing for maximum speed
            const endAngle = startAngle + (extent * Math.PI / 180);

            if (this.#isDown) {
                // Draw the complete circle/arc using line segments
                const segments = 100;
                for (let i = 0; i <= segments; i++) {
                    const segmentAngle = startAngle + (extent * (i / segments) * Math.PI / 180);
                    const x = centerX + Math.abs(radius) * Math.cos(segmentAngle);
                    const y = centerY + Math.abs(radius) * Math.sin(segmentAngle);

                    if (i === 0) {
                        this.#ctx.beginPath();
                        this.#ctx.moveTo(x, y);
                    } else {
                        this.#ctx.lineTo(x, y);
                        this.#ctx.stroke();
                        this.#ctx.beginPath();
                        this.#ctx.moveTo(x, y);
                    }
                }
            }

            // Update final turtle position
            this.#x = centerX + Math.abs(radius) * Math.cos(endAngle);
            this.#y = centerY + Math.abs(radius) * Math.sin(endAngle);

            // Update final turtle angle
            const tangentAngle = (endAngle * 180 / Math.PI) + (counterClockwise ? -90 : 90);
            this.#angle = tangentAngle;
            this.#updateState(state);

            this.#drawTurtle();
        }
        
        return Promise.resolve();
    }

    async dot(size=null, color=null) {
        return this.#queueOperation(() => {
            this.#clearTurtle();
            this.#saveState();
            
            const oldColor = this.#color;
            const oldWidth = this.#penSize;
            
            if (color) this.#color = this.#col_arg(color);
            if (size === null) size = Math.max(this.#penSize + 4, this.#penSize * 2);
            
            const [screenX, screenY] = this.#worldToScreen(this.#x, this.#y);
            
            this.#ctx.beginPath();
            this.#ctx.arc(screenX, screenY, size/2, 0, 2 * Math.PI);
            this.#ctx.fillStyle = this.#color;
            this.#ctx.fill();
            
            this.#color = this.#col_arg(oldColor);
            this._pensize(oldWidth);
            
            this.#drawTurtle();
        });
    }

    async begin_fill() {
        return this.#queueOperation(() => {
            
            // Start a new fill path
            this.#filling = true;
            this.#fillPath = new Path2D();
            
            // Add the current position to the fill path
            const [screenX, screenY] = this.#worldToScreen(this.#x, this.#y);
            this.#fillPath.moveTo(screenX, screenY);
            
            this.#saveState('begin_fill', []);
        });
    }

    async end_fill(fill_rule=defaults.fillRule) {
        return this.#queueOperation(() => {
            let state = this.#saveState('end_fill', [fill_rule]);
            this.#clearTurtle();
            if (this.#filling && this.#fillPath) {
                // Close the path
                this.#fillPath.closePath();
                                
                // Fill the path
                this.#ctx.fillStyle = this.#fillcolor;
                this.#ctx.fill(this.#fillPath, fill_rule);
                
                // Reset fill state
                state.filling = this.#filling = false;
                state.do_fill_path = new Path2D(this.#fillPath);
                state.fillPath = this.#fillPath = null;
            }
            this.#drawTurtle();
        });
    }

    async filling() {
        return this.#queueOperation(() => {
            return this.#filling;
        });
    }

    // three call variants
    // pencolor(color)
    // pencolor()
    // pencolor(r, g, b)
    async pencolor(...color) {
        return this.#queueOperation(() => {
            if (color.length === 0) return this.#col_user(this.#color);
            this.#clearTurtle();
            if (color.length === 3) this.#color = this.#col_arg(color);
            else if (color.length === 1) this.#color = this.#col_arg(color[0]);
            this.#ctx.strokeStyle = this.#color;
            this.#saveState('pencolor', color);
            this.#drawTurtle();
        });
    }

    async fillcolor(...color) {
        return this.#queueOperation(() => {
            if (color.length === 0) return this.#col_user(this.#fillcolor);
            this.#clearTurtle();
            if (color.length === 3) this.#fillcolor = this.#col_arg(color);
            else if (color.length === 1) this.#fillcolor = this.#col_arg(color[0]);
            this.#ctx.fillStyle = this.#fillcolor;
            this.#saveState('fillcolor', color);
            this.#drawTurtle();
        });
    }

    // Reset and clear
    async reset() {
        return this.#queueOperation(async () => {
            this._reset();
        });
    }

    _reset() {
        this._clear();

        // Reset turtle properties
        this.#x = 0;
        this.#y = 0;
        this.#angle = 0;
        this.#isDown = true;
        this.#drawSpeed = 1;
        this.#color = 'black';
        this.#fillcolor = 'black';
        this.#penSize = 1;
        this.#isVisible = true;
        this.#currentShape = defaults.shape;

        // Reset context properties
        this.#ctx.strokeStyle = 'black';
        this.#ctx.fillStyle = 'black';
        this.#ctx.lineWidth = 1;

        // Reset world coordinates
        const naturalCoords = this.#screen.naturalWorldCoordinates();
        this._setworldcoordinates(
            naturalCoords.left,
            naturalCoords.bottom,
            naturalCoords.right,
            naturalCoords.top
        );

        // Clear undo buffer
        this.#undoBuffer = [];
        this.#pathBuffer = [];
        
        // Draw the turtle in its initial state
        this.#drawTurtle();
    }

    // Write text
    async write(text, move=false, align="left", font=["Arial", 8, "normal"]) {
        return this.#queueOperation(() => {
            this._write(text, move, align, font);
        });
    }

    _write(text, move=false, align="left", font=["Arial", 8, "normal"]) {
        this.#clearTurtle();
        
        // Convert world coordinates to screen coordinates
        const [screenX, screenY] = this.#worldToScreen(this.#x, this.#y);
        
        this.#ctx.fillStyle = this.#color;
        this.#ctx.textAlign = align;
        this.#ctx.font = `${font[2]} ${font[1]}px ${font[0]}`;
        
        // Calculate text rotation based on turtle angle
        const radians = (-this.#angle * Math.PI) / 180;
        
        // Save context state for text rotation
        this.#ctx.save();
        this.#ctx.translate(screenX, screenY);
        this.#ctx.rotate(radians);
        this.#ctx.fillText(text, 0, 0);
        this.#ctx.restore();

        if (move) {
            // Move to the end of the text in world coordinates
            const metrics = this.#ctx.measureText(text);
            const distance = metrics.width;
            const dx = distance * Math.cos(radians);
            
            // Convert screen distance back to world coordinates
            const scaleX = this.#canvas.width / (this.#worldCoordinates.right - this.#worldCoordinates.left);
            this.#x += dx / scaleX;
        }
        this.#saveState('write', [text, move, align, font]);

        this.#drawTurtle();
    }

    // Stamp methods
    async stamp() {
        return this.#queueOperation(() => {
            const stampId = this.#stampIds++;
            this.#stamps.set(stampId, {
                x: this.#x,
                y: this.#y,
                angle: this.#angle,
                shape: this.#currentShape
            });
            this.#drawTurtle(true);
            return stampId;
        });
    }

    async clearstamp(stampId) {
        return this.#queueOperation(() => {
            this.#stamps.delete(stampId);
            this.#redrawStamps();
        });
    }

    async clearstamps(n=null) {
        return this.#queueOperation(() => {
            if (n === null) {
                this.#stamps.clear();
            } else if (n > 0) {
                const stamps = Array.from(this.#stamps.entries()).slice(-n);
                stamps.forEach(([id]) => this.#stamps.delete(id));
            } else {
                const stamps = Array.from(this.#stamps.entries()).slice(0, -n);
                stamps.forEach(([id]) => this.#stamps.delete(id));
            }
            this.#redrawStamps();
        });
    }

    // Tilt and rotation
    async tilt(angle) {
        return this.#queueOperation(() => {
            this.#tiltAngle = (this.#tiltAngle + angle) % 360;
            this.#saveState('tilt', [angle]);
        });
    }

    tiltangle(angle=null) {
        return this.#queueOperation(() => {
            if (angle === null) return this.#tiltAngle;
            this.#tiltAngle = angle;
            this.#saveState('tiltangle', [angle]);
        });
    }

    async speed(speed=null) {
        return this.#queueOperation(() => {
            this._speed(speed);
        });
    }

    // Speed control
    _speed(speed=null) {
        if (speed === null) return this.#drawSpeed;
        // 'fastest' : 0
        // 'fast' : 10
        // 'normal' : 6
        // 'slow' : 3
        // 'slowest' : 1
        if (typeof speed === 'string') {
            switch(speed.toLowerCase()) {
                case 'fastest': speed = 0; break;
                case 'fast': speed = 10; break;
                case 'normal': speed = 6; break;
                case 'slow': speed = 3; break;
                case 'slowest': speed = 1; break;
                default: throw new Error('Invalid speed string');
            }
        }
        this.#drawSpeed = Math.max(0, Math.min(10, speed));
        this.#saveState('speed', [speed]);
    }

    // Mode settings
    mode(mode=null) {
        if (mode === null) return this.#mode;
        if (['standard', 'logo', 'world'].includes(mode)) {
            this.#mode = mode;
        } else {
            throw new Error('Mode must be "standard", "logo", or "world"');
        }
    }

    #redrawStamps() {
        // Clear the canvas
        this.#clearTurtle();
        this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

        // Redraw all stamps
        for (const [id, stamp] of this.#stamps) {
            // Convert stamp position to screen coordinates
            const [screenX, screenY] = this.#worldToScreen(stamp.x, stamp.y);
            
            // Draw the stamp using the stored shape
            const shape = this.#shapes[stamp.shape];
            const transformedShape = shape.map(([x, y]) => {
                // Rotate the point
                const radians = (stamp.angle * Math.PI) / 180;
                const rotatedX = x * Math.cos(radians) - y * Math.sin(radians);
                const rotatedY = x * Math.sin(radians) + y * Math.cos(radians);
                
                return [
                    screenX + rotatedX,
                    screenY + rotatedY
                ];
            });

            this.#ctx.beginPath();
            this.#ctx.moveTo(transformedShape[0][0], transformedShape[0][1]);
            for (const [x, y] of transformedShape.slice(1)) {
                this.#ctx.lineTo(x, y);
            }
            this.#ctx.closePath();
            this.#ctx.fillStyle = this.#color;
            this.#ctx.fill();
            this.#ctx.strokeStyle = this.#color;
            this.#ctx.stroke();
        }

        // Redraw the turtle
        if (this.#isVisible) {
            this.#drawTurtle();
        }
    }

    async undo() {
        return this.#queueOperation(() => {
            if (this.#undoBuffer.length === 0) return;
            
            // Remove the last operation from the undo buffer
            const lastState = this.#undoBuffer.pop();
            
            // Special handling for begin_fill/end_fill pairs
            if (lastState.action === 'end_fill') {
                // If we're undoing an end_fill, we need to restore the filling state
                this.#filling = true;
                
                // Find the matching begin_fill to get the original fill path
                let beginFillIndex = -1;
                for (let i = this.#undoBuffer.length - 1; i >= 0; i--) {
                    if (this.#undoBuffer[i].action === 'begin_fill') {
                        beginFillIndex = i;
                        break;
                    }
                }
                
                if (beginFillIndex >= 0) {
                    // Restore the fill path from the begin_fill state (create a copy)
                    this.#fillPath = new Path2D(this.#undoBuffer[beginFillIndex].fillPath);
                } else {
                    // If we can't find the begin_fill, create a new path
                    this.#fillPath = new Path2D();
                    const [screenX, screenY] = this.#worldToScreen(lastState.x, lastState.y);
                    this.#fillPath.moveTo(screenX, screenY);
                }
            } else if (lastState.action === 'begin_fill') {
                // If we're undoing a begin_fill, cancel the current fill operation
                this.#filling = false;
                this.#fillPath = null;
            } else {
                // For other operations, restore the fill path if we're in filling mode
                if (lastState.filling && lastState.fillPath) {
                    this.#filling = true;
                    // Create a copy of the stored fill path
                    this.#fillPath = new Path2D(lastState.fillPath);
                }
            }
            
            // Restore turtle state from the last state in the buffer
            // or use default values if buffer is now empty
            if (this.#undoBuffer.length > 0) {
                const currentState = this.#undoBuffer[this.#undoBuffer.length - 1];
                this.#x = currentState.x;
                this.#y = currentState.y;
                this.#angle = currentState.angle;
                this.#isDown = currentState.isDown;
                this.#color = currentState.color;
                this.#penSize = currentState.penSize;
                this.#isVisible = currentState.isVisible;
                this.#worldCoordinates = { ...currentState.worldCoordinates };
                this.#resizeMode = currentState.resizeMode;
                this.#stretchFactors = { ...currentState.stretchFactors };
                
                // Only update filling state if we haven't already handled it above
                if (lastState.action !== 'begin_fill' && lastState.action !== 'end_fill') {
                    this.#filling = currentState.filling;
                    this.#fillcolor = currentState.fillColor;
                }
            } else {
                // Reset to default state if buffer is empty
                this.#x = 0;
                this.#y = 0;
                this.#angle = 0;
                this.#isDown = true;
                this.#color = 'black';
                this.#penSize = 1;
                this.#isVisible = true;
                this.#filling = false;
                this.#fillcolor = 'black';
                this.#fillPath = null;
                // ... other default values ...
            }
            
            // Mark that we need to update the canvas
            this.#needsUpdate = true;
            
            // Redraw everything
            this._update();
        });
    }

    async listen(xdummy=null, ydummy=null) {
        return this.#queueOperation(() => {
            this.#screen.listen();
        });
    }

    // Add getter/setter for user angle conversion
    get #user_angle() {
        return (this.#angle * this.#fullcircle) / 360;
    }
    
    set #user_angle(angle) {
        this.#angle = (angle * 360) / this.#fullcircle;
    }

    // Add the new methods
    async degrees(fullcircle=360.0) {
        return this.#queueOperation(() => {
            this.#fullcircle = fullcircle;
        });
    }

    async radians() {
        return this.#queueOperation(() => {
            this.#fullcircle = 2 * Math.PI;
        });
    }

    // Update heading getter to use #user_angle
    async heading() {
        return this.#queueOperation(() => {
            return this.#user_angle;
        });
    }

    // Update setheading to use #user_angle
    _setheading(angle) { 
        this.#user_angle = angle;
    }

    // Add isdown() method
    async isdown() {
        return this.#queueOperation(() => {
            return this.#isDown;
        });
    }

    // Add pen() method to get pen state
    async pen() {
        return this.#queueOperation(() => {
            return {
                shown: this.#isVisible,
                pendown: this.#isDown,
                pencolor: this.#color,
                fillcolor: this.#fillcolor,
                pensize: this.#penSize,
                speed: this.#drawSpeed,
                resizemode: this.#resizeMode,
                stretchfactor: { ...this.#stretchFactors },
                outline: this.#stretchFactors.outline
            };
        });
    }

    // Add getpen() as alias for pen()
    async getpen() {
        return this;
    }

    async getturtle() {
        return this;
    }


    // Add getscreen() method
    getscreen() {
        return this.#screen;
    }

    // Add clone() method
    async clone() {
        return this.#queueOperation(() => {
            return new Turtle(this);
        })
    }

    // Add title method
    async title(titlestring=null) {
        return this.#queueOperation(() => {
            if (titlestring === null) {
                return document.title;
            }
            document.title = titlestring;
            return titlestring;
        });
    }

    async _getstate() {
        return this.#queueOperation(() => {
            return {
                // Screen configuration
                width: this.#canvas.width,  // width of the canvas or fraction i.e. 0.5 for half screen height
                height: this.#canvas.height, // height of the canvas or fraction i.e. 0.5 for half screen width
                canvwidth: this.#canvas.width, // width of the canvas
                canvheight: this.#canvas.height, // height of the canvas
                leftright: defaults.leftright,
                topbottom: defaults.topbottom,
                colormode: this.#colormode, // 1.0 for RGB values between 0 and 1, or 255 for RGB values between 0 and 255
                
                // Turtle configuration
                undobuffersize: this.#undobuffersize,
                
                // Current state (private properties)
                delay: this.#delay,
                x: this.#x,
                y: this.#y,
                angle: this.#angle,
                isDown: this.#isDown,
                drawSpeed: this.#drawSpeed,
                pencolor: this.#color,
                penSize: this.#penSize,
                visible: this.#isVisible,
                turtleSize: this.#turtleSize,
                shape: this.#currentShape,
                filling: this.#filling,
                fillcolor: this.#fillcolor,
                tiltAngle: this.#tiltAngle,
                mode: this.#mode,
                resizeMode: this.#resizeMode,
                stretchFactors: { ...this.#stretchFactors },
                fullcircle: this.#fullcircle,
                maxUndoSteps: this.#maxUndoSteps,
                
                // World coordinates
                world: this.#worldCoordinates ? {
                    left: this.#worldCoordinates.left,
                    right: this.#worldCoordinates.right,
                    top: this.#worldCoordinates.top,
                    bottom: this.#worldCoordinates.bottom,
                    scaleX: this.#worldCoordinates.scaleX,
                    scaleY: this.#worldCoordinates.scaleY
                } : null,
                
                // Canvas properties
                canvas: {
                    width: this.#canvas.width,
                    height: this.#canvas.height,
                    imageSmoothing: this.#imageSmoothing,
                    imageSmoothingQuality: this.#imageSmoothingQuality
                }
            };
        });
    }

    _setstate(state){
        // this.#canvas.width = state.canvas.width;
        // this.#canvas.height = state.canvas.height;
        // this.#imageRendering = state.canvas.imageRendering;
        // this.#imageSmoothing = state.canvas.imageSmoothing;
        // this.#imageSmoothingQuality = state.canvas.imageSmoothingQuality;
        // this.#worldCoordinates = state.world;
        // this.#delay = state.delay;
        this.#x = state.x;
        this.#y = state.y;
        this.#angle = state.angle;
        this.#isDown = state.isDown;
        this.#drawSpeed = state.drawSpeed;
        this.#color = state.pencolor;
        this.#penSize = state.penSize;
        this.#isVisible = state.visible;
        this.#turtleSize = state.turtleSize;
        this.#currentShape = state.shape;
        this.#filling = state.filling;
        this.#fillcolor = state.fillcolor;
        this.#tiltAngle = state.tiltAngle;
        this.#resizeMode = state.resizeMode;
        this.#fullcircle = state.fullcircle;
        this.#undobuffersize = state.undobuffersize;
        this.#stretchFactors = state.stretchFactors;
        this.#maxUndoSteps = state.maxUndoSteps;

        // this.#mode = state.mode;
        // this.#keyHandlers = state.keyHandlers;
        // this.#shapes = state.shapes;
        // this.#colormode = state.colormode;
        // this.#worldCoordinates = state.world;
        // this.#stamps = state.stamps;
    }
    
    // set #worldCoordinates(coords) {
    //     this.#screen.setworldcoordinates(
    //         coords.left,
    //         coords.bottom,
    //         coords.right,
    //         coords.top
    //     );
    // }

    // Add a new method to update the canvas based on path buffer
    async update() {
        return this.#queueOperation(() => {
            this._update();
        });
    }

    /**
     * Calculates the canvas transform and scale parameters to draw a path
     * from old world coordinates to new world coordinates.
     * @param {Object} oldCoords - The old world coordinates {top, bottom, left, right}.
     * @param {Object} newCoords - The new world coordinates {top, bottom, left, right}.
     * @param {string} translateAround - The (x,y)  point to center around or 
     *                                   'origin' for (0,0) or 
     *                                   'center' for (width/2, height/2) or 
     *                                   'none' for no translation.
     * @returns {Object} - The transform and scale parameters.
     */
    #getTranslateAndScale(oldCoords, newCoords, translateAround='none') {
        const scaleX = (newCoords.right - newCoords.left) / (oldCoords.right - oldCoords.left);
        const scaleY = (newCoords.bottom - newCoords.top) / (oldCoords.bottom - oldCoords.top);

        let translateX = 0;
        let translateY = 0;

        if (translateAround === 'origin') {
            translateAround = [0,0];
        } else if (translateAround === 'center') {
            translateAround = [(oldCoords.right - oldCoords.left)/2, (oldCoords.bottom - oldCoords.top)/2];
        }else if (translateAround === 'topleft') {
            translateAround = [oldCoords.left, oldCoords.top];
        }else if (translateAround === 'bottomright') {
            translateAround = [oldCoords.right, oldCoords.bottom];
        }else if (translateAround === 'bottomleft') {
            translateAround = [oldCoords.left, oldCoords.bottom];
        }else if (translateAround === 'topright') {
            translateAround = [oldCoords.right, oldCoords.top];
        }

        if (translateAround !== 'none') {
            translateX = (translateAround[0] - oldCoords.left)*scaleX - translateAround[0];
            translateY = (translateAround[1] - oldCoords.top)*scaleY - translateAround[1];
        }

        return {
            scaleX,
            scaleY,
            translateX,
            translateY
        };
    }

    #worldcoordIsEqual(wCoords_a, wCoords_b) {
        if (!wCoords_a || !wCoords_b) {
            return false;
        }
        return wCoords_a.left === wCoords_b.left &&
               wCoords_a.right === wCoords_b.right &&
               wCoords_a.top === wCoords_b.top &&
               wCoords_a.bottom === wCoords_b.bottom;
    }

    #calculateTransform(oldCoords, newCoords, translateAround='none') {
        const { scaleX, scaleY, translateX, translateY } = this.#getTranslateAndScale(oldCoords, newCoords, translateAround);
        return { scaleX, scaleY, translateX, translateY };
    }

    _update() {
        if (!this.#needsUpdate) return;
        
        // Clear the canvas
        this.#clearTurtle();
        this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
        
        // If we have a snapshot, start with that
        if (this.#pathBuffer.length > 0 && this.#pathBuffer[0].type === 'snapshot') {
            this.#ctx.putImageData(this.#pathBuffer[0].imageData, 0, 0);
        }
        
        this.#screen.naturalWorldCoordinates();

        this.#ctx.save();

        // Redraw all paths from the undo buffer
        for (const state of this.#undoBuffer) {
            if (!this.#worldcoordIsEqual(state.worldCoordinates, this.#worldCoordinates)) {
                // go over points and use convert to screen coordinates then redraw path
                state.path = this.#createPathFromPoints(state.points);
                state.worldCoordinates = { ...this.#worldCoordinates };
            }

            // Draw stroke paths
            if (state.path) {
                        
                // Set the context properties based on the state
                this.#ctx.strokeStyle = state.color;
                this.#ctx.lineWidth = state.penSize;
                
                // Draw the path
                this.#ctx.stroke(state.path);
            }
            
            // Draw fill paths
            if (state.do_fill_path) {
                // Set the fill color
                this.#ctx.fillStyle = state.fillColor;
                
                // Fill the path
                this.#ctx.fill(state.do_fill_path);
                
            }
        }

        this.#ctx.restore();
        
        // Redraw the turtle if visible
        if (this.#isVisible) {
            this.#drawTurtle();
        }
        
        this.#needsUpdate = false;
    }

    /**
     * Creates a Path2D from an array of points in world coordinates
     * @param {Array} points - Array of points in format [[x1,y1], [x2,y2], ...]
     * @returns {Path2D} - The created path
     */
    #createPathFromPoints(points) {
        if (!points || points.length < 2) {
            return null;
        }
        
        const path = new Path2D();
        
        // Convert first point to screen coordinates and move to it
        const [screenX, screenY] = this.#worldToScreen(points[0][0], points[0][1]);
        path.moveTo(screenX, screenY);
        
        // Add line segments to remaining points
        for (let i = 1; i < points.length; i++) {
            const [nextScreenX, nextScreenY] = this.#worldToScreen(points[i][0], points[i][1]);
            path.lineTo(nextScreenX, nextScreenY);
        }
        
        return path;
    }
    
    // Helper function for simple line paths (convenience wrapper)
    #createLinePath(startX, startY, endX, endY) {
        return this.#createPathFromPoints([[startX, startY], [endX, endY]]);
    }

    /**
     * Helper function to add a point to a state's path
     * @param {Object} state - The state object to modify
     * @param {number} x - X coordinate in world coordinates
     * @param {number} y - Y coordinate in world coordinates
     * @param {boolean} isMoveTo - Whether this is a moveTo operation (default: false)
     * @param {boolean} isScreenCoord - Whether x,y are given already in screen coordinates (default: false)
     */
    #addPointToState(state, x, y, isMoveTo = false, isScreenCoord = false) {
        if (!state) return;
        
        // Convert world coordinates to screen coordinates
        const [screenX, screenY] = isScreenCoord ? [x, y] : this.#worldToScreen(x, y);
        
        // Create path if it doesn't exist
        let state_path_is_move_to = isMoveTo;
        if (!state.path) {
            state.path = new Path2D();
            state_path_is_move_to = true;
        }

        if (!this.#isDown) {
            state_path_is_move_to = true;
        }
        
        // Add point to the path
        if (state_path_is_move_to) {
            state.path.moveTo(screenX, screenY);
        } else {
            state.path.lineTo(screenX, screenY);
        }
        
        // If we're filling, also add the point to the fill path
        if (this.#filling && this.#fillPath) {
            if (isMoveTo) {
                this.#fillPath.moveTo(screenX, screenY);
            } else {
                this.#fillPath.lineTo(screenX, screenY);
            }
            
            // Store a copy of the updated fill path in the state
            state.fillPath = new Path2D(this.#fillPath);
        }
        // update the state's pen properties
        state.x = this.#x;
        state.y = this.#y;
        state.angle = this.#angle;
        state.isDown = this.#isDown;
        state.color = this.#color;
        state.penSize = this.#penSize;
        state.isVisible = this.#isVisible;
        state.fillcolor = this.#fillcolor;
        state.filling = this.#filling;
        state.points = (state.points || []);
        if (state.isDown) {
            state.points.push([x,y]);
        }
    }

    #updateState(state) {
        // Update the state with the current turtle pen properties
        state.x = this.#x;
        state.y = this.#y;
        state.angle = this.#angle;
        state.isDown = this.#isDown;
        state.color = this.#color;
        state.penSize = this.#penSize;
        state.isVisible = this.#isVisible;
        state.worldCoordinates = { ...this.#worldCoordinates };
        state.resizeMode = this.#resizeMode;
        state.stretchFactors = { ...this.#stretchFactors };
        state.fillcolor = this.#fillcolor;
        state.filling = this.#filling;
    }
}

class Screen {
    #canvas;
    #ctx;
    #turtles = new Set();
    #delay = defaults.delay;
    #colormode = defaults.colormode;
    #colormode_keep_names = defaults.colormode_keep_names;
    #mode = defaults.mode;
    #title = defaults.title;
    #worldCoordinates = null;
    #keyHandlers = new Map();
    #shapes;
    #imageRendering;
    #backgroundImage = null;

    constructor(canvas, config = defaults) {
        this.#canvas = canvas;
        this.#ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // Initialize default world coordinates
        const naturalCoords = this.naturalWorldCoordinates();
        this.#worldCoordinates = {
            left: naturalCoords.left,
            bottom: naturalCoords.bottom,
            right: naturalCoords.right,
            top: naturalCoords.top,
            scaleX: naturalCoords.scaleX,
            scaleY: naturalCoords.scaleY
        };
        
        this.#mode = config.mode;
        this.#delay = config.delay;
        this.#colormode = config.colormode;
        this.#colormode_keep_names = config.colormode_keep_names;
        this.#title = config.title;
        this.#shapes = config.shapes;
        this.#imageRendering = config.imageRendering;
        this.imageRendering(this.#imageRendering);
    }

    naturalWorldCoordinates(){
        return {
            left: -this.#canvas.width/2,
            bottom: -this.#canvas.height/2,
            right: this.#canvas.width/2,
            top: this.#canvas.height/2,
            scaleX: 1,
            scaleY: 1,
        };
    }

    canvasWorldCoordinates(){
        return {
            left: 0,
            top: 0,
            right: this.#canvas.width,
            bottom: this.#canvas.height,
            scaleX: 1,
            scaleY: 1,
        }
    }

    imageRendering(rendering=null) {
        if (rendering === null) return this.#imageRendering;
        if (['auto', 'high-performance', 'crisp-edges', 'pixelated'].includes(rendering)) {
            this.#imageRendering = rendering;
        } else {
            throw new Error("imageRendering() expects 'auto', 'high-performance', 'crisp-edges', or 'pixelated'");
        }
        if (!this.#canvas.style.imageRendering || this.#canvas.style.imageRendering !== rendering) {
            this.#canvas.style.imageRendering = rendering;
        }
    }

    // Window control methods
    async bgcolor(...color) {
        if (color.length === 0) return this._user_color(this.#canvas.style.backgroundColor);
        if (color.length === 3) this.#canvas.style.backgroundColor = this._color_arg_normalize(color);
        else if (color.length === 1) this.#canvas.style.backgroundColor = this._color_arg_normalize(color[0]);
        else throw new Error("bgcolor() expects 0, 1, or 3 arguments");
    }

    async bgpic(picname=null) {
        if (picname === null) {
            return this.#backgroundImage ? this.#backgroundImage.src : "nopic";
        }

        if (picname === "nopic") {
            // Remove background image if exists
            if (this.#backgroundImage) {
                this.#backgroundImage = null;
                //this.#redrawCanvas();
            }
            return "nopic";
        }

        // Load and set the background image
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.#backgroundImage = img;
                //this.#redrawCanvas();
                resolve(picname);
            };
            img.onerror = () => {
                reject(new Error(`Failed to load image: ${picname}`));
            };
            img.src = picname;
        });
    }

    async screensize(width=null, height=null, bgColor=null) {
        if (width !== null && height !== null) {
            this.#canvas.width = width;
            this.#canvas.height = height;
        }
        
        if (bgColor !== null) {
            this.#canvas.style.backgroundColor = bgColor;
        }
        
        return [this.#canvas.width, this.#canvas.height];
    }

    async setworldcoordinates(left, bottom, right, top) {
        this.#worldCoordinates = {
            left,
            bottom,
            right,
            top,
            scaleX: this.#canvas.width / (right - left),
            scaleY: this.#canvas.height / (top - bottom)
        };

        // Update all turtles with new coordinates
        this.#turtles.forEach(turtle => turtle._setworldcoordinates());
    }

    // Event handling methods
    listen() {
        this.#canvas.tabIndex = 0;
        this.#canvas.focus();
    }

    onkey(fun=null, key=null) {
        if (fun === null) {
            if (key) {
                document.removeEventListener('keyup', this.#keyHandlers.get(key));
                this.#keyHandlers.delete(key);
            } else {
                this.#keyHandlers.forEach((handler, key) => {
                    document.removeEventListener('keyup', handler);
                });
                this.#keyHandlers.clear();
            }
            return;
        }

        const keyMap = {
            'space': ' ',
            'return': 'Enter',
            'tab': 'Tab',
            'backspace': 'Backspace',
            'delete': 'Delete',
            'escape': 'Escape',
            'up': 'ArrowUp',
            'down': 'ArrowDown',
            'left': 'ArrowLeft',
            'right': 'ArrowRight'
        };

        const normalizedKey = keyMap[key.toLowerCase()] || key.toLowerCase();
        const handler = (event) => {
            if (event.key.toLowerCase() === normalizedKey.toLowerCase()) {
                fun();
            }
        };

        this.#keyHandlers.set(key, handler);
        document.addEventListener('keyup', handler);
    }

    // Settings methods
    mode(mode=null) {
        if (mode === null) return this.#mode;
        if (['standard', 'logo', 'world'].includes(mode)) {
            this.#mode = mode;
            // Update all turtles with new mode
            this.#turtles.forEach(turtle => turtle._updateMode(mode));
        }
    }

    colormode(mode=null) {
        if (mode === null) return this.#colormode;
        this.#colormode = mode;
    }

    colormode_keep_names(keep=null) {
        if (keep === null) return this.#colormode_keep_names;
        this.#colormode_keep_names = keep;
    }

    getcanvas(){
        return this.#canvas
    }

    getshapes() {
        return Object.keys(this.#shapes);
    }

    register_shape(name, shape) {
        this.#shapes[name] = shape;
    }

    addshape(name, shape) {
        return this.register_shape(name, shape);
    }

    turtles() {
        return Array.from(this.#turtles);
    }

    window_height() {
        return this.#canvas.height;
    }

    window_width() {
        return this.#canvas.width;
    }

    title(titlestring=null) {
        if (titlestring === null) {
            return document.title;
        }
        document.title = titlestring;
        return titlestring;
    }

    // Turtle management methods
    addTurtle(turtle) {
        this.#turtles.add(turtle);
    }

    removeTurtle(turtle) {
        this.#turtles.delete(turtle);
    }

    // Getter for shapes
    getShape(name) {
        return this.#shapes[name];
    }

    // Getter for world coordinates
    getWorldCoordinates() {
        return {...this.#worldCoordinates};
    }

    // Animation control methods
    async delay(ms=null) {
        if (ms === null) return this.#delay;
        this.#delay = ms;
    }

    async tracer(n=null, delay=null) {
        // TODO: Implement screen update control
        console.warn("tracer() is not yet implemented");
    }

    async update() {
        // TODO: Perform screen update
        console.warn("update() is not yet implemented");
    }

    // Window control methods
    async clearscreen() {
        this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
        // Reset all turtles to home position
        this.#turtles.forEach(turtle => turtle._home());
    }

    async resetscreen() {
        // Clear screen and reset all turtles
        await this.clearscreen();
        // Reset world coordinates to default
        const naturalCoords = this.naturalWorldCoordinates();
        this.setworldcoordinates(
            naturalCoords.left,
            naturalCoords.top,
            naturalCoords.right,
            naturalCoords.bottom
        );
    }

    // Event handling methods
    async onclick(fun, btn=1, add=null) {
        if (!fun) {
            this.#canvas.onclick = null;
            this.#canvas.onauxclick = null;
            return;
        }

        const handler = (event) => {
            const rect = this.#canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const [worldX, worldY] = this._screenToWorld(x, y);
            fun(worldX, worldY);
        };

        if (btn === 1) {
            if (add) {
                const oldHandler = this.#canvas.onclick;
                this.#canvas.onclick = (e) => {
                    if (oldHandler) oldHandler(e);
                    handler(e);
                };
            } else {
                this.#canvas.onclick = handler;
            }
        } else if (btn === 2 || btn === 3) {
            if (add) {
                const oldHandler = this.#canvas.onauxclick;
                this.#canvas.onauxclick = (e) => {
                    if (e.button === (btn === 2 ? 1 : 2)) {
                        if (oldHandler) oldHandler(e);
                        handler(e);
                    }
                };
            } else {
                this.#canvas.onauxclick = (e) => {
                    if (e.button === (btn === 2 ? 1 : 2)) handler(e);
                };
            }
        }
    }

    onrelease(fun, btn=1, add=false) {
        let that = this;
        if (!fun) {
            this.#canvas.onmouseup = null;
            return;
        }

        const handler = (event) => {
            if (event.button !== btn-1) {
                return;
            }
            const rect = that.#canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const [worldX, worldY] = that._screenToWorld(x, y);
            fun(worldX, worldY);
        };

        if (add) {
            const oldHandler = this.#canvas.onmouseup;
            this.#canvas.onmouseup = (e) => {
                if (oldHandler) oldHandler(e);
                handler(e);
            };
        } else {
            this.#canvas.onmouseup = handler;
        }
    }

    onscreenclick(fun, btn=1, add=null) {
        return this.onclick(fun, btn, add);
    }

    ondrag(fun, btn=1, add=false) {
        let that = this;
        if (!fun) {
            // Remove all drag handlers if fun is null/undefined
            this.#canvas.onmousemove = null;
            return;
        }

        const handler = (event) => {
            // Only process if mouse button is pressed (drag)
            if (!(event.buttons & (1 << (btn-1)))) {
                return;
            }

            // Get coordinates relative to canvas
            const rect = that.#canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Convert screen coordinates to world coordinates
            const [worldX, worldY] = that._screenToWorld(x, y);

            // Call the user function with world coordinates
            fun(worldX, worldY);
        };

        if (add) {
            const oldHandler = this.#canvas.onmousemove;
            this.#canvas.onmousemove = (e) => {
                if (oldHandler) oldHandler(e);
                handler(e);
            };
        } else {
            this.#canvas.onmousemove = handler;
        }
    }

    ontimer(fun, t=0) {
        setTimeout(fun, t);
    }

    // Input methods
    async textinput(title, prompt) {
        return prompt(prompt, "");
    }

    async numinput(title, prompt, default_=null, minval=null, maxval=null) {
        let value;
        while (true) {
            const input = prompt(prompt, default_ !== null ? default_.toString() : "");
            if (input === null) return null;
            
            value = parseFloat(input);
            if (isNaN(value)) {
                alert("Not a number");
                continue;
            }
            
            if (minval !== null && value < minval) {
                alert(`Minimum value is ${minval}`);
                continue;
            }
            
            if (maxval !== null && value > maxval) {
                alert(`Maximum value is ${maxval}`);
                continue;
            }
            
            break;
        }
        return value;
    }

    // Special methods
    async bye() {
        // Clean up resources
        this.#turtles.clear();
        this.#keyHandlers.clear();
        // Remove canvas from DOM if needed
        if (this.#canvas.parentNode) {
            this.#canvas.parentNode.removeChild(this.#canvas);
        }
    }

    async exitonclick() {
        let that = this;
        const handler = () => {
            that.bye();
            that.#canvas.removeEventListener('click', handler);
        };
        this.#canvas.addEventListener('click', handler);
    }

    async setup(width=defaults.width, height=defaults.height, startx=null, starty=null) {
        // Set canvas size
        if (typeof width === 'number' && width <= 1) {
            width = Math.floor(window.innerWidth * width);
        }
        if (typeof height === 'number' && height <= 1) {
            height = Math.floor(window.innerHeight * height);
        }
        
        this.#canvas.width = width;
        this.#canvas.height = height;

        // Position canvas if coordinates provided
        if (startx !== null && starty !== null) {
            this.#canvas.style.position = 'absolute';
            this.#canvas.style.left = `${startx}px`;
            this.#canvas.style.top = `${starty}px`;
        }

        // Reset world coordinates
        this.setworldcoordinates(
            -width/2,
            -height/2,
            width/2,
            height/2
        );
    }

    // Coordinate conversion helpers
    _screenToWorld(x, y) {
        return [
            x / this.#worldCoordinates.scaleX + this.#worldCoordinates.left,
            -(y / this.#worldCoordinates.scaleY - this.#worldCoordinates.top)
        ];
    }

    _worldToScreen(x, y) {
        return [
            (x - this.#worldCoordinates.left) * this.#worldCoordinates.scaleX,
            (this.#worldCoordinates.top - y) * this.#worldCoordinates.scaleY
        ];
    }

    // Color argument normalization
    _color_arg_normalize(color) {
        if (color === null) return null;
        
        // Convert to RGB array first
        let rgb;
        if (Array.isArray(color)) {
            // Handle array input
            if (color.length === 3) {
                if (this.#colormode === 1.0) {
                    // Convert 0-1 values to 0-255
                    rgb = color.map(value => Math.round(value * 255));
                } else {
                    rgb = color.map(Math.floor);
                }
            } else {
                throw new Error("Color arrays must have exactly 3 elements");
            }
        } else if (typeof color === 'string') {
            color = color.trim();
            if (tk_colors[color]) {
                return tk_colors[color];
            }
            color = color.replace(' ', '');
            if (color.startsWith('#') && color.length === 7) {
                return color;  // Return valid hex color as-is
            } else if (color.startsWith('rgb')) {
                // Parse rgb(r,g,b) format
                rgb = color.slice(4, -1).split(',').map(x => parseInt(x.trim()));
            } else {
                // Assume it's a named color or hex color
                return color
            }
        } else if (typeof color === 'number') {
            // Handle numeric color input
            rgb = [
                color & 0xFF,
                (color >> 8) & 0xFF,
                (color >> 16) & 0xFF
            ];
        } else {
            return '#000000'; // Default to black for invalid inputs
        }

        // Ensure values are in valid range
        rgb = rgb.map(v => Math.max(0, Math.min(255, v)));
        
        // Convert to hex string
        return '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('');
    }

    // This function converts a normalized color (a string like #FFFFFF) to a color in the format set by colormode
    _user_color(color) {
        if (typeof color === 'string' && !color.startsWith('#')) {
            return color;
        }
        if (typeof color !== 'string') {
            throw new Error("_user_color() expects a string");
        }
        if (this.#colormode_keep_names) {
            return hex_to_colors[color];
        }
        let rgb = color.slice(1).match(/.{1,2}/g).map(x => parseInt(x, 16));
        if (this.#colormode === 1.0) {
            return rgb.map(x => Math.round((x*10000/255)) / 10000 );
        }
        return rgb;
    }

}

let defaultTurtle=null;
let defaultScreen=null;

function getDefaultScreen() {
    if (defaultScreen === null) {
        defaultScreen = new Screen(document.createElement('canvas'), defaults);
    }
    return defaultScreen;
}


function getDefaultTurtle() {
    if (defaultTurtle === null) {
        defaultTurtle = new Turtle(getDefaultScreen());
    }
    return defaultTurtle;
}

function setDefaultTurtle(turtle) {
    if (turtle instanceof Turtle) {
        defaultTurtle = turtle;
    } else {
        throw new Error("setDefaultTurtle() expects a Turtle instance");
    }
    setDefaultScreen(turtle.getscreen());
}

function setDefaultScreen(screen) {
    if (screen instanceof Screen) {
        defaultScreen = screen;
    } else {
        throw new Error("setDefaultScreen() expects a Screen instance");
    }
}


// Export both Turtle and Screen classes
let turtleExports;

function export_turtle_globals(scope_obj=window) {
    // Export the turtle graphics functions globally
    for (const [name, func] of Object.entries(turtleExports)) {
        if (typeof func === 'function' || typeof func === 'class') {
            scope_obj[name] = func;
        }
    }
}

const turtlejs = {
    "Turtle": Turtle,
    "Screen": Screen,
    async forward(distance) { return await getDefaultTurtle().forward(distance); },
    async fd(distance) { return await getDefaultTurtle().fd(distance); },
    async backward(distance) { return await getDefaultTurtle().backward(distance); },
    async bk(distance) { return await getDefaultTurtle().bk(distance); },
    async back(distance) { return await getDefaultTurtle().back(distance); },
    async right(angle) { return await getDefaultTurtle().right(angle); },
    async rt(angle) { return await getDefaultTurtle().rt(angle); },
    async left(angle) { return await getDefaultTurtle().left(angle); },
    async lt(angle) { return await getDefaultTurtle().left(angle); },
    async goto(x, y) { return await getDefaultTurtle().goto(x, y); },
    async setpos(x, y) { return await getDefaultTurtle().setpos(x, y); },
    async setposition(x, y) { return await getDefaultTurtle().setposition(x, y); },
    async teleport(x, y) { return await getDefaultTurtle().teleport(x, y); },
    async setx(x) { return await getDefaultTurtle().setx(x); },
    async sety(y) { return await getDefaultTurtle().sety(y); },
    async setheading(angle) { return await getDefaultTurtle().setheading(angle); },
    async seth(angle) { return await getDefaultTurtle().seth(angle); },
    async home() { return await getDefaultTurtle().home(); },
    async circle(radius, extent) { return await getDefaultTurtle().circle(radius, extent); },
    async dot(size, color) { return await getDefaultTurtle().dot(size, color); },
    async stamp() { return await getDefaultTurtle().stamp(); },
    async clearstamp(stampid) { return await getDefaultTurtle().clearstamp(stampid); },
    async clearstamps(n) { return await getDefaultTurtle().clearstamps(n); },
    async undo() { return await getDefaultTurtle().undo(); },
    async speed(speed) { return await getDefaultTurtle().speed(speed); },

    async position() { return await getDefaultTurtle().position(); },
    async pos() { return await getDefaultTurtle().pos(); },
    async towards(x, y) { return await getDefaultTurtle().towards(x, y); },
    async xcor() { return await getDefaultTurtle().xcor(); },
    async ycor() { return await getDefaultTurtle().ycor(); },
    async heading() { return await getDefaultTurtle().heading(); },
    async distance(x, y) { return await getDefaultTurtle().distance(x, y); },

    async degrees() { return await getDefaultTurtle().degrees(); },
    async radians() { return await getDefaultTurtle().radians(); },

    async pendown() { return await getDefaultTurtle().pendown(); },
    async pd() { return await getDefaultTurtle().pd(); },
    async down() { return await getDefaultTurtle().down(); },
    async penup() { return await getDefaultTurtle().penup(); },
    async pu() { return await getDefaultTurtle().pu(); },
    async up() { return await getDefaultTurtle().up(); },
    async pensize(size) { return getDefaultTurtle().pensize(size); },
    async width(size) { return getDefaultTurtle().width(size); },
    async pen(pen) { return await getDefaultTurtle().pen(pen); },
    async isdown() { return await getDefaultTurtle().isdown(); },

    async color(...color) { return await getDefaultTurtle().color(...color); },
    async pencolor(...color) { return await getDefaultTurtle().pencolor(...color); },
    async fillcolor(...color) { return await getDefaultTurtle().fillcolor(...color); },

    async filling() { return await getDefaultTurtle().filling(); },
    async begin_fill() { return await getDefaultTurtle().begin_fill(); },
    async end_fill() { return await getDefaultTurtle().end_fill(); },

    async reset() { return await getDefaultTurtle().reset(); },
    async clear() { return await getDefaultTurtle().clear(); },
    async write(arg, move, align, font) { return await getDefaultTurtle().write(arg, move, align, font); },

    async showturtle() { return await getDefaultTurtle().showturtle(); },
    async st() { return await getDefaultTurtle().st(); },
    async hideturtle() { return await getDefaultTurtle().hideturtle(); },
    async ht() { return await getDefaultTurtle().ht(); },
    async isvisible() { return await getDefaultTurtle().isvisible(); },

    async shape(shape) { return await getDefaultTurtle().shape(shape); },
    async resizemode(mode) { return await getDefaultTurtle().resizemode(mode); },
    async shapesize(stretch_wid, stretch_len, outline) { return await getDefaultTurtle().shapesize(stretch_wid, stretch_len, outline); },
    async turtlesize(stretch_wid, stretch_len, outline) { return await getDefaultTurtle().turtlesize(stretch_wid, stretch_len, outline); },
    async shearfactor(shear_x, shear_y) { return await getDefaultTurtle().shearfactor(shear_x, shear_y); },
    async tiltangle(angle) { return await getDefaultTurtle().tiltangle(angle); },
    async tilt(angle) { return await getDefaultTurtle().tilt(angle); },
    async shapetransform(shape, transform) { return await getDefaultTurtle().shapetransform(shape, transform); },
    async get_shapepoly(shape) { return await getDefaultTurtle().get_shapepoly(shape); },

    async onclick(fun, btn, add) { return await getDefaultTurtle().onclick(fun, btn, add); },
    async onrelease(fun, btn, add) { return await getDefaultScreen().onrelease(fun, btn, add); },
    async ondrag(fun, btn, add) { return await getDefaultScreen().ondrag(fun, btn, add); },

    async begin_poly() { return await getDefaultTurtle().begin_poly(); },
    async end_poly() { return await getDefaultTurtle().end_poly(); },
    async get_poly() { return await getDefaultTurtle().get_poly(); },
    async clone() { return await getDefaultTurtle().clone(); },
    async getturtle() { return await getDefaultTurtle().getturtle(); },
    async getpen() { return await getDefaultTurtle().getpen(); },
    async getscreen() { return await getDefaultTurtle().getscreen(); },
    async setundobuffer(n) { return await getDefaultTurtle().setundobuffer(n); },
    async undobufferentries() { return await getDefaultTurtle().undobufferentries(); },

    async bgcolor(...color) { return await getDefaultScreen().bgcolor(...color); },
    async bgpic(picname) { return await getDefaultScreen().bgpic(picname); },
    async clearscreen() { return await getDefaultScreen().clearscreen(); },
    async resetscreen() { return await getDefaultScreen().resetscreen(); },
    async screensize(width, height, bgColor) { return await getDefaultScreen().screensize(width, height, bgColor); },
    async setworldcoordinates(left, bottom, right, top) { return await getDefaultScreen().setworldcoordinates(left, bottom, right, top); },

    async delay(ms) { return await getDefaultScreen().delay(ms); },
    async tracer(n, delay) { return await getDefaultScreen().tracer(n, delay); },
    async update() { return await getDefaultScreen().update(); },

    async listen() { return await getDefaultScreen().listen(); },
    async onkey(fun, key) { return await getDefaultScreen().onkey(fun, key); },
    async onkeyrelease(fun, key) { return await getDefaultScreen().onkeyrelease(fun, key); },
    async onkeypress(fun, key) { return await getDefaultScreen().onkeypress(fun, key); },
    async onscreenclick(fun, btn, add) { return await getDefaultScreen().onscreenclick(fun, btn, add); },
    async ontimer(fun, t) { return await getDefaultScreen().ontimer(fun, t); },
    async mainloop() { return Promise.accept(); /*return await getDefaultScreen().mainloop();*/ },
    async done() { return Promise.accept(); /*return await getDefaultScreen().done();*/ },

    async mode(mode) { return await getDefaultScreen().mode(mode); },
    async colormode(mode) { return await getDefaultScreen().colormode(mode); },
    async getcanvas() { return await getDefaultScreen().getcanvas(); },
    async getshapes() { return await getDefaultScreen().getshapes(); },
    async register_shape(name, shape) { return await getDefaultScreen().register_shape(name, shape); },
    async addshape(name, shape) { return await getDefaultScreen().addshape(name, shape); },
    async turtles() { return await getDefaultScreen().turtles(); },
    async window_height() { return await getDefaultScreen().window_height(); },
    async window_width() { return await getDefaultScreen().window_width(); },

    async textinput(title, prompt) { return await getDefaultScreen().textinput(title, prompt); },
    async numinput(title, prompt, default_, minval, maxval) { return await getDefaultScreen().numinput(title, prompt, default_, minval, maxval); },

    async bye() { return await getDefaultScreen().bye(); },
    async exitonclick() { return await getDefaultScreen().exitonclick(); },
    async setup(width, height, startx, starty) { return await getDefaultScreen().setup(width, height, startx, starty); },
    async title(titlestring) { return await getDefaultScreen().title(titlestring); },

    // unofficial api methods
    async colormode_keep_names(keep) { return await getDefaultScreen().colormode_keep_names(keep); },
    async imageRendering(rendering) { return await getDefaultScreen().imageRendering(rendering); },
    setDefaultTurtle,
    setDefaultScreen,
    export_turtle_globals,

    // ?
    async getShape(name) { return await getDefaultScreen().getShape(name); },
    async getWorldCoordinates() { return await getDefaultScreen().getWorldCoordinates(); },
    async addTurtle(turtle) { return await getDefaultScreen().addTurtle(turtle); },
    async removeTurtle(turtle) { return await getDefaultScreen().removeTurtle(turtle); },
};
turtleExports = turtlejs;


// Export turtle movement functions
const forward = turtlejs.forward;
const fd = turtlejs.fd;
const backward = turtlejs.backward;
const bk = turtlejs.bk;
const back = turtlejs.back;
const right = turtlejs.right;
const rt = turtlejs.rt;
const left = turtlejs.left;
const lt = turtlejs.lt;
const goto = turtlejs.goto;
const setpos = turtlejs.setpos;
const setposition = turtlejs.setposition;
const teleport = turtlejs.teleport;
const setx = turtlejs.setx;
const sety = turtlejs.sety;
const setheading = turtlejs.setheading;
const seth = turtlejs.seth;
const home = turtlejs.home;

// Export pen control functions
const pendown = turtlejs.pendown;
const pd = turtlejs.pd;
const down = turtlejs.down;
const penup = turtlejs.penup;
const pu = turtlejs.pu;
const up = turtlejs.up;
const pensize = turtlejs.pensize;
const width = turtlejs.width;
const pen = turtlejs.pen;
const isdown = turtlejs.isdown;

// Export color and fill functions
const color = turtlejs.color;
const pencolor = turtlejs.pencolor;
const fillcolor = turtlejs.fillcolor;
const filling = turtlejs.filling;
const begin_fill = turtlejs.begin_fill;
const end_fill = turtlejs.end_fill;

// Export drawing functions
const circle = turtlejs.circle;
const dot = turtlejs.dot;
const stamp = turtlejs.stamp;
const clearstamp = turtlejs.clearstamp;
const clearstamps = turtlejs.clearstamps;
const write = turtlejs.write;

// Export state and position functions
const position = turtlejs.position;
const pos = turtlejs.pos;
const towards = turtlejs.towards;
const xcor = turtlejs.xcor;
const ycor = turtlejs.ycor;
const heading = turtlejs.heading;
const distance = turtlejs.distance;

// Export angle measurement functions
const degrees = turtlejs.degrees;
const radians = turtlejs.radians;

// Export clear and reset functions
const reset = turtlejs.reset;
const clear = turtlejs.clear;

// Export visibility functions
const showturtle = turtlejs.showturtle;
const st = turtlejs.st;
const hideturtle = turtlejs.hideturtle;
const ht = turtlejs.ht;
const isvisible = turtlejs.isvisible;

// Export shape functions
const shape = turtlejs.shape;
const resizemode = turtlejs.resizemode;
const shapesize = turtlejs.shapesize;
const turtlesize = turtlejs.turtlesize;
const tiltangle = turtlejs.tiltangle;
const tilt = turtlejs.tilt;

// Export event handlers
const onclick = turtlejs.onclick;
const onrelease = turtlejs.onrelease;
const ondrag = turtlejs.ondrag;
const listen = turtlejs.listen;
const onkey = turtlejs.onkey;
const onkeyrelease = turtlejs.onkeyrelease;
const onkeypress = turtlejs.onkeypress;
const onscreenclick = turtlejs.onscreenclick;
const ontimer = turtlejs.ontimer;

// Export polygon functions
const begin_poly = turtlejs.begin_poly;
const end_poly = turtlejs.end_poly;
const get_poly = turtlejs.get_poly;

// Export turtle management functions
const clone = turtlejs.clone;
const getturtle = turtlejs.getturtle;
const getpen = turtlejs.getpen;
const getscreen = turtlejs.getscreen;
const setundobuffer = turtlejs.setundobuffer;
const undobufferentries = turtlejs.undobufferentries;
const undo = turtlejs.undo;

// Export screen functions
const bgcolor = turtlejs.bgcolor;
const bgpic = turtlejs.bgpic;
const clearscreen = turtlejs.clearscreen;
const resetscreen = turtlejs.resetscreen;
const screensize = turtlejs.screensize;
const setworldcoordinates = turtlejs.setworldcoordinates;
const delay = turtlejs.delay;
const tracer = turtlejs.tracer;
const update = turtlejs.update;
const mode = turtlejs.mode;
const colormode = turtlejs.colormode;
const getcanvas = turtlejs.getcanvas;
const getshapes = turtlejs.getshapes;
const register_shape = turtlejs.register_shape;
const addshape = turtlejs.addshape;
const turtles = turtlejs.turtles;
const window_height = turtlejs.window_height;
const window_width = turtlejs.window_width;
const title = turtlejs.title;

// Export dialog functions
const textinput = turtlejs.textinput;
const numinput = turtlejs.numinput;

// Export control functions
const bye = turtlejs.bye;
const exitonclick = turtlejs.exitonclick;
const setup = turtlejs.setup;
const mainloop = turtlejs.mainloop;
const done = turtlejs.done;

// Export unofficial API methods
const colormode_keep_names = turtlejs.colormode_keep_names;
const imageRendering = turtlejs.imageRendering;


if (typeof module !== 'undefined' && module.exports) {
    module.exports = turtlejs;
}

// origin: https://www.tcl-lang.org/man/tcl/TkCmd/colors.htm
tk_colors = `
alice blue         240        248        255
AliceBlue          240        248        255
antique whi        250        235        215
AntiqueWhit        250        235        215
AntiqueWhit        255        239        219
AntiqueWhit        238        223        204
AntiqueWhit        205        192        176
AntiqueWhit        139        131        120
agua                 0        255        255
aquamarine         127        255        212
aquamarine1        127        255        212
aquamarine2        118        238        198
aquamarine3        102        205        170
aquamarine4         69        139        116
azure              240        255        255
azure1             240        255        255
azure2             224        238        238
azure3             193        205        205
azure4             131        139        139
beige              245        245        220
bisque             255        228        196
bisque1            255        228        196
bisque2            238        213        183
bisque3            205        183        158
bisque4            139        125        107
black                0          0          0
blanched al        255        235        205
BlanchedAlm        255        235        205
blue                 0          0        255
blue violet        138         43        226
blue1                0          0        255
blue2                0          0        238
blue3                0          0        205
blue4                0          0        139
BlueViolet         138         43        226
brown              165         42         42
brown1             255         64         64
brown2             238         59         59
brown3             205         51         51
brown4             139         35         35
burlywood          222        184        135
burlywood1         255        211        155
burlywood2         238        197        145
burlywood3         205        170        125
burlywood4         139        115         85
cadet blue          95        158        160
CadetBlue           95        158        160
CadetBlue1         152        245        255
CadetBlue2         142        229        238
CadetBlue3         122        197        205
CadetBlue4          83        134        139
chartreuse         127        255          0
chartreuse1        127        255          0
chartreuse2        118        238          0
chartreuse3        102        205          0
chartreuse4         69        139          0
chocolate          210        105         30
chocolate1         255        127         36
chocolate2         238        118         33
chocolate3         205        102         29
chocolate4         139         69         19
coral              255        127         80
coral1             255        114         86
coral2             238        106         80
coral3             205         91         69
coral4             139         62         47
cornflower         100        149        237
CornflowerB        100        149        237
cornsilk           255        248        220
cornsilk1          255        248        220
cornsilk2          238        232        205
cornsilk3          205        200        177
cornsilk4          139        136        120
crymson            220         20         60
cyan                 0        255        255
cyan1                0        255        255
cyan2                0        238        238
cyan3                0        205        205
cyan4                0        139        139
dark blue            0          0        139
dark cyan            0        139        139
dark golden        184        134         11
dark gray          169        169        169
dark green           0        100          0
dark grey          169        169        169
dark khaki         189        183        107
dark magent        139          0        139
dark olive          85        107         47
dark orange        255        140          0
dark orchid        153         50        204
dark red           139          0          0
dark salmon        233        150        122
dark sea gr        143        188        143
dark slate          72         61        139
dark slate          47         79         79
dark slate          47         79         79
dark turquo          0        206        209
dark violet        148          0        211
DarkBlue             0          0        139
DarkCyan             0        139        139
DarkGoldenr        184        134         11
DarkGoldenr        255        185         15
DarkGoldenr        238        173         14
DarkGoldenr        205        149         12
DarkGoldenr        139        101          8
DarkGray           169        169        169
DarkGreen            0        100          0
DarkGrey           169        169        169
DarkKhaki          189        183        107
DarkMagenta        139          0        139
DarkOliveGr         85        107         47
DarkOliveGr        202        255        112
DarkOliveGr        188        238        104
DarkOliveGr        162        205         90
DarkOliveGr        110        139         61
DarkOrange         255        140          0
DarkOrange1        255        127          0
DarkOrange2        238        118          0
DarkOrange3        205        102          0
DarkOrange4        139         69          0
DarkOrchid         153         50        204
DarkOrchid1        191         62        255
DarkOrchid2        178         58        238
DarkOrchid3        154         50        205
DarkOrchid4        104         34        139
DarkRed            139          0          0
DarkSalmon         233        150        122
DarkSeaGree        143        188        143
DarkSeaGree        193        255        193
DarkSeaGree        180        238        180
DarkSeaGree        155        205        155
DarkSeaGree        105        139        105
DarkSlateBl         72         61        139
DarkSlateGr         47         79         79
DarkSlateGr        151        255        255
DarkSlateGr        141        238        238
DarkSlateGr        121        205        205
DarkSlateGr         82        139        139
DarkSlateGr         47         79         79
DarkTurquoi          0        206        209
DarkViolet         148          0        211
deep pink          255         20        147
deep sky bl          0        191        255
DeepPink           255         20        147
DeepPink1          255         20        147
DeepPink2          238         18        137
DeepPink3          205         16        118
DeepPink4          139         10         80
DeepSkyBlue          0        191        255
DeepSkyBlue          0        191        255
DeepSkyBlue          0        178        238
DeepSkyBlue          0        154        205
DeepSkyBlue          0        104        139
dim gray           105        105        105
dim grey           105        105        105
DimGray            105        105        105
DimGrey            105        105        105
dodger blue         30        144        255
DodgerBlue          30        144        255
DodgerBlue1         30        144        255
DodgerBlue2         28        134        238
DodgerBlue3         24        116        205
DodgerBlue4         16         78        139
firebrick          178         34         34
firebrick1         255         48         48
firebrick2         238         44         44
firebrick3         205         38         38
firebrick4         139         26         26
floral whit        255        250        240
FloralWhite        255        250        240
forest gree         34        139         34
ForestGreen         34        139         34
fuchsia            255          0        255
gainsboro          220        220        220
ghost white        248        248        255
GhostWhite         248        248        255
gold               255        215          0
gold1              255        215          0
gold2              238        201          0
gold3              205        173          0
gold4              139        117          0
goldenrod          218        165         32
goldenrod1         255        193         37
goldenrod2         238        180         34
goldenrod3         205        155         29
goldenrod4         139        105         20
gray               128        128        128
gray0                0          0          0
gray1                3          3          3
gray2                5          5          5
gray3                8          8          8
gray4               10         10         10
gray5               13         13         13
gray6               15         15         15
gray7               18         18         18
gray8               20         20         20
gray9               23         23         23
gray10              26         26         26
gray11              28         28         28
gray12              31         31         31
gray13              33         33         33
gray14              36         36         36
gray15              38         38         38
gray16              41         41         41
gray17              43         43         43
gray18              46         46         46
gray19              48         48         48
gray20              51         51         51
gray21              54         54         54
gray22              56         56         56
gray23              59         59         59
gray24              61         61         61
gray25              64         64         64
gray26              66         66         66
gray27              69         69         69
gray28              71         71         71
gray29              74         74         74
gray30              77         77         77
gray31              79         79         79
gray32              82         82         82
gray33              84         84         84
gray34              87         87         87
gray35              89         89         89
gray36              92         92         92
gray37              94         94         94
gray38              97         97         97
gray39              99         99         99
gray40             102        102        102
gray41             105        105        105
gray42             107        107        107
gray43             110        110        110
gray44             112        112        112
gray45             115        115        115
gray46             117        117        117
gray47             120        120        120
gray48             122        122        122
gray49             125        125        125
gray50             127        127        127
gray51             130        130        130
gray52             133        133        133
gray53             135        135        135
gray54             138        138        138
gray55             140        140        140
gray56             143        143        143
gray57             145        145        145
gray58             148        148        148
gray59             150        150        150
gray60             153        153        153
gray61             156        156        156
gray62             158        158        158
gray63             161        161        161
gray64             163        163        163
gray65             166        166        166
gray66             168        168        168
gray67             171        171        171
gray68             173        173        173
gray69             176        176        176
gray70             179        179        179
gray71             181        181        181
gray72             184        184        184
gray73             186        186        186
gray74             189        189        189
gray75             191        191        191
gray76             194        194        194
gray77             196        196        196
gray78             199        199        199
gray79             201        201        201
gray80             204        204        204
gray81             207        207        207
gray82             209        209        209
gray83             212        212        212
gray84             214        214        214
gray85             217        217        217
gray86             219        219        219
gray87             222        222        222
gray88             224        224        224
gray89             227        227        227
gray90             229        229        229
gray91             232        232        232
gray92             235        235        235
gray93             237        237        237
gray94             240        240        240
gray95             242        242        242
gray96             245        245        245
gray97             247        247        247
gray98             250        250        250
gray99             252        252        252
gray100            255        255        255
green                0        128          0
green yello        173        255         47
green1               0        255          0
green2               0        238          0
green3               0        205          0
green4               0        139          0
GreenYellow        173        255         47
grey               128        128        128
grey0                0          0          0
grey1                3          3          3
grey2                5          5          5
grey3                8          8          8
grey4               10         10         10
grey5               13         13         13
grey6               15         15         15
grey7               18         18         18
grey8               20         20         20
grey9               23         23         23
grey10              26         26         26
grey11              28         28         28
grey12              31         31         31
grey13              33         33         33
grey14              36         36         36
grey15              38         38         38
grey16              41         41         41
grey17              43         43         43
grey18              46         46         46
grey19              48         48         48
grey20              51         51         51
grey21              54         54         54
grey22              56         56         56
grey23              59         59         59
grey24              61         61         61
grey25              64         64         64
grey26              66         66         66
grey27              69         69         69
grey28              71         71         71
grey29              74         74         74
grey30              77         77         77
grey31              79         79         79
grey32              82         82         82
grey33              84         84         84
grey34              87         87         87
grey35              89         89         89
grey36              92         92         92
grey37              94         94         94
grey38              97         97         97
grey39              99         99         99
grey40             102        102        102
grey41             105        105        105
grey42             107        107        107
grey43             110        110        110
grey44             112        112        112
grey45             115        115        115
grey46             117        117        117
grey47             120        120        120
grey48             122        122        122
grey49             125        125        125
grey50             127        127        127
grey51             130        130        130
grey52             133        133        133
grey53             135        135        135
grey54             138        138        138
grey55             140        140        140
grey56             143        143        143
grey57             145        145        145
grey58             148        148        148
grey59             150        150        150
grey60             153        153        153
grey61             156        156        156
grey62             158        158        158
grey63             161        161        161
grey64             163        163        163
grey65             166        166        166
grey66             168        168        168
grey67             171        171        171
grey68             173        173        173
grey69             176        176        176
grey70             179        179        179
grey71             181        181        181
grey72             184        184        184
grey73             186        186        186
grey74             189        189        189
grey75             191        191        191
grey76             194        194        194
grey77             196        196        196
grey78             199        199        199
grey79             201        201        201
grey80             204        204        204
grey81             207        207        207
grey82             209        209        209
grey83             212        212        212
grey84             214        214        214
grey85             217        217        217
grey86             219        219        219
grey87             222        222        222
grey88             224        224        224
grey89             227        227        227
grey90             229        229        229
grey91             232        232        232
grey92             235        235        235
grey93             237        237        237
grey94             240        240        240
grey95             242        242        242
grey96             245        245        245
grey97             247        247        247
grey98             250        250        250
grey99             252        252        252
grey100            255        255        255
honeydew           240        255        240
honeydew1          240        255        240
honeydew2          224        238        224
honeydew3          193        205        193
honeydew4          131        139        131
hot pink           255        105        180
HotPink            255        105        180
HotPink1           255        110        180
HotPink2           238        106        167
HotPink3           205         96        144
HotPink4           139         58         98
indian red         205         92         92
IndianRed          205         92         92
IndianRed1         255        106        106
IndianRed2         238         99         99
IndianRed3         205         85         85
IndianRed4         139         58         58
indigo              75          0        130
ivory              255        255        240
ivory1             255        255        240
ivory2             238        238        224
ivory3             205        205        193
ivory4             139        139        131
khaki              240        230        140
khaki1             255        246        143
khaki2             238        230        133
khaki3             205        198        115
khaki4             139        134         78
lavender           230        230        250
lavender bl        255        240        245
LavenderBlu        255        240        245
LavenderBlu        255        240        245
LavenderBlu        238        224        229
LavenderBlu        205        193        197
LavenderBlu        139        131        134
lawn green         124        252          0
LawnGreen          124        252          0
lemon chiff        255        250        205
LemonChiffo        255        250        205
LemonChiffo        255        250        205
LemonChiffo        238        233        191
LemonChiffo        205        201        165
LemonChiffo        139        137        112
light blue         173        216        230
light coral        240        128        128
light cyan         224        255        255
light golde        238        221        130
light golde        250        250        210
light gray         211        211        211
light green        144        238        144
light grey         211        211        211
light pink         255        182        193
light salmo        255        160        122
light sea g         32        178        170
light sky b        135        206        250
light slate        132        112        255
light slate        119        136        153
light slate        119        136        153
light steel        176        196        222
light yello        255        255        224
LightBlue          173        216        230
LightBlue1         191        239        255
LightBlue2         178        223        238
LightBlue3         154        192        205
LightBlue4         104        131        139
LightCoral         240        128        128
LightCyan          224        255        255
LightCyan1         224        255        255
LightCyan2         209        238        238
LightCyan3         180        205        205
LightCyan4         122        139        139
LightGolden        238        221        130
LightGolden        255        236        139
LightGolden        238        220        130
LightGolden        205        190        112
LightGolden        139        129         76
LightGolden        250        250        210
LightGray          211        211        211
LightGreen         144        238        144
LightGrey          211        211        211
LightPink          255        182        193
LightPink1         255        174        185
LightPink2         238        162        173
LightPink3         205        140        149
LightPink4         139         95        101
LightSalmon        255        160        122
LightSalmon        255        160        122
LightSalmon        238        149        114
LightSalmon        205        129         98
LightSalmon        139         87         66
LightSeaGre         32        178        170
LightSkyBlu        135        206        250
LightSkyBlu        176        226        255
LightSkyBlu        164        211        238
LightSkyBlu        141        182        205
LightSkyBlu         96        123        139
LightSlateB        132        112        255
LightSlateG        119        136        153
LightSlateG        119        136        153
LightSteelB        176        196        222
LightSteelB        202        225        255
LightSteelB        188        210        238
LightSteelB        162        181        205
LightSteelB        110        123        139
LightYellow        255        255        224
LightYellow        255        255        224
LightYellow        238        238        209
LightYellow        205        205        180
LightYellow        139        139        122
lime                 0        255          0
lime green          50        205         50
LimeGreen           50        205         50
linen              250        240        230
magenta            255          0        255
magenta1           255          0        255
magenta2           238          0        238
magenta3           205          0        205
magenta4           139          0        139
maroon             128          0          0
maroon1            255         52        179
maroon2            238         48        167
maroon3            205         41        144
maroon4            139         28         98
medium aqua        102        205        170
medium blue          0          0        205
medium orch        186         85        211
medium purp        147        112        219
medium sea          60        179        113
medium slat        123        104        238
medium spri          0        250        154
medium turq         72        209        204
medium viol        199         21        133
MediumAquam        102        205        170
MediumBlue           0          0        205
MediumOrchi        186         85        211
MediumOrchi        224        102        255
MediumOrchi        209         95        238
MediumOrchi        180         82        205
MediumOrchi        122         55        139
MediumPurpl        147        112        219
MediumPurpl        171        130        255
MediumPurpl        159        121        238
MediumPurpl        137        104        205
MediumPurpl         93         71        139
MediumSeaGr         60        179        113
MediumSlate        123        104        238
MediumSprin          0        250        154
MediumTurqu         72        209        204
MediumViole        199         21        133
midnight bl         25         25        112
MidnightBlu         25         25        112
mint cream         245        255        250
MintCream          245        255        250
misty rose         255        228        225
MistyRose          255        228        225
MistyRose1         255        228        225
MistyRose2         238        213        210
MistyRose3         205        183        181
MistyRose4         139        125        123
moccasin           255        228        181
navajo whit        255        222        173
NavajoWhite        255        222        173
NavajoWhite        255        222        173
NavajoWhite        238        207        161
NavajoWhite        205        179        139
NavajoWhite        139        121         94
navy                 0          0        128
navy blue            0          0        128
NavyBlue             0          0        128
old lace           253        245        230
OldLace            253        245        230
olive              128        128          0
olive drab         107        142         35
OliveDrab          107        142         35
OliveDrab1         192        255         62
OliveDrab2         179        238         58
OliveDrab3         154        205         50
OliveDrab4         105        139         34
orange             255        165          0
orange red         255         69          0
orange1            255        165          0
orange2            238        154          0
orange3            205        133          0
orange4            139         90          0
OrangeRed          255         69          0
OrangeRed1         255         69          0
OrangeRed2         238         64          0
OrangeRed3         205         55          0
OrangeRed4         139         37          0
orchid             218        112        214
orchid1            255        131        250
orchid2            238        122        233
orchid3            205        105        201
orchid4            139         71        137
pale golden        238        232        170
pale green         152        251        152
pale turquo        175        238        238
pale violet        219        112        147
PaleGoldenr        238        232        170
PaleGreen          152        251        152
PaleGreen1         154        255        154
PaleGreen2         144        238        144
PaleGreen3         124        205        124
PaleGreen4          84        139         84
PaleTurquoi        175        238        238
PaleTurquoi        187        255        255
PaleTurquoi        174        238        238
PaleTurquoi        150        205        205
PaleTurquoi        102        139        139
PaleVioletR        219        112        147
PaleVioletR        255        130        171
PaleVioletR        238        121        159
PaleVioletR        205        104        127
PaleVioletR        139         71         93
papaya whip        255        239        213
PapayaWhip         255        239        213
peach puff         255        218        185
PeachPuff          255        218        185
PeachPuff1         255        218        185
PeachPuff2         238        203        173
PeachPuff3         205        175        149
PeachPuff4         139        119        101
peru               205        133         63
pink               255        192        203
pink1              255        181        197
pink2              238        169        184
pink3              205        145        158
pink4              139         99        108
plum               221        160        221
plum1              255        187        255
plum2              238        174        238
plum3              205        150        205
plum4              139        102        139
powder blue        176        224        230
PowderBlue         176        224        230
purple             128          0        128
purple1            155         48        255
purple2            145         44        238
purple3            125         38        205
purple4             85         26        139
red                255          0          0
red1               255          0          0
red2               238          0          0
red3               205          0          0
red4               139          0          0
rosy brown         188        143        143
RosyBrown          188        143        143
RosyBrown1         255        193        193
RosyBrown2         238        180        180
RosyBrown3         205        155        155
RosyBrown4         139        105        105
royal blue          65        105        225
RoyalBlue           65        105        225
RoyalBlue1          72        118        255
RoyalBlue2          67        110        238
RoyalBlue3          58         95        205
RoyalBlue4          39         64        139
saddle brow        139         69         19
SaddleBrown        139         69         19
salmon             250        128        114
salmon1            255        140        105
salmon2            238        130         98
salmon3            205        112         84
salmon4            139         76         57
sandy brown        244        164         96
SandyBrown         244        164         96
sea green           46        139         87
SeaGreen            46        139         87
SeaGreen1           84        255        159
SeaGreen2           78        238        148
SeaGreen3           67        205        128
SeaGreen4           46        139         87
seashell           255        245        238
seashell1          255        245        238
seashell2          238        229        222
seashell3          205        197        191
seashell4          139        134        130
sienna             160         82         45
sienna1            255        130         71
sienna2            238        121         66
sienna3            205        104         57
sienna4            139         71         38
silver             192        192        192
sky blue           135        206        235
SkyBlue            135        206        235
SkyBlue1           135        206        255
SkyBlue2           126        192        238
SkyBlue3           108        166        205
SkyBlue4            74        112        139
slate blue         106         90        205
slate gray         112        128        144
slate grey         112        128        144
SlateBlue          106         90        205
SlateBlue1         131        111        255
SlateBlue2         122        103        238
SlateBlue3         105         89        205
SlateBlue4          71         60        139
SlateGray          112        128        144
SlateGray1         198        226        255
SlateGray2         185        211        238
SlateGray3         159        182        205
SlateGray4         108        123        139
SlateGrey          112        128        144
snow               255        250        250
snow1              255        250        250
snow2              238        233        233
snow3              205        201        201
snow4              139        137        137
spring gree          0        255        127
SpringGreen          0        255        127
SpringGreen          0        255        127
SpringGreen          0        238        118
SpringGreen          0        205        102
SpringGreen          0        139         69
steel blue          70        130        180
SteelBlue           70        130        180
SteelBlue1          99        184        255
SteelBlue2          92        172        238
SteelBlue3          79        148        205
SteelBlue4          54        100        139
tan                210        180        140
tan1               255        165         79
tan2               238        154         73
tan3               205        133         63
tan4               139         90         43
teal                 0        128        128
thistle            216        191        216
thistle1           255        225        255
thistle2           238        210        238
thistle3           205        181        205
thistle4           139        123        139
tomato             255         99         71
tomato1            255         99         71
tomato2            238         92         66
tomato3            205         79         57
tomato4            139         54         38
turquoise           64        224        208
turquoise1           0        245        255
turquoise2           0        229        238
turquoise3           0        197        205
turquoise4           0        134        139
violet             238        130        238
violet red         208         32        144
VioletRed          208         32        144
VioletRed1         255         62        150
VioletRed2         238         58        140
VioletRed3         205         50        120
VioletRed4         139         34         82
wheat              245        222        179
wheat1             255        231        186
wheat2             238        216        174
wheat3             205        186        150
wheat4             139        126        102
white              255        255        255
white smoke        245        245        245
WhiteSmoke         245        245        245
yellow             255        255          0
yellow gree        154        205         50
yellow1            255        255          0
yellow2            238        238          0
yellow3            205        205          0
yellow4            139        139          0
YellowGreen        154        205         50
`.split('\n').map(line => line.trim()).filter(line => line.length > 3).map(line => {
    let [name, r, g, b] = line.split(/\s\s+/).map(x => x.trim());
    return { name, r, g, b };
}).reduce((acc, color) => {
    acc[color.name] = '#'+ ([color.r, color.g, color.b].map(x => parseInt(x, 10)).map(x => Math.round(x).toString(16).padStart(2, '0')).join(''));
    return acc;
}, {});

hex_to_colors = Object.fromEntries(Object.entries(tk_colors)
    .sort((a, b) => b[0].length - a[0].length)
    .map(([key, value]) => [value, key]));

exports.Screen = Screen;
exports.Turtle = Turtle;
exports.addshape = addshape;
exports.back = back;
exports.backward = backward;
exports.begin_fill = begin_fill;
exports.begin_poly = begin_poly;
exports.bgcolor = bgcolor;
exports.bgpic = bgpic;
exports.bk = bk;
exports.bye = bye;
exports.circle = circle;
exports.clear = clear;
exports.clearscreen = clearscreen;
exports.clearstamp = clearstamp;
exports.clearstamps = clearstamps;
exports.clone = clone;
exports.color = color;
exports.colormode = colormode;
exports.colormode_keep_names = colormode_keep_names;
exports.degrees = degrees;
exports.delay = delay;
exports.distance = distance;
exports.done = done;
exports.dot = dot;
exports.down = down;
exports.end_fill = end_fill;
exports.end_poly = end_poly;
exports.exitonclick = exitonclick;
exports.export_turtle_globals = export_turtle_globals;
exports.fd = fd;
exports.fillcolor = fillcolor;
exports.filling = filling;
exports.forward = forward;
exports.get_poly = get_poly;
exports.getcanvas = getcanvas;
exports.getpen = getpen;
exports.getscreen = getscreen;
exports.getshapes = getshapes;
exports.getturtle = getturtle;
exports.goto = goto;
exports.heading = heading;
exports.hideturtle = hideturtle;
exports.home = home;
exports.ht = ht;
exports.imageRendering = imageRendering;
exports.isdown = isdown;
exports.isvisible = isvisible;
exports.left = left;
exports.listen = listen;
exports.lt = lt;
exports.mainloop = mainloop;
exports.mode = mode;
exports.numinput = numinput;
exports.onclick = onclick;
exports.ondrag = ondrag;
exports.onkey = onkey;
exports.onkeypress = onkeypress;
exports.onkeyrelease = onkeyrelease;
exports.onrelease = onrelease;
exports.onscreenclick = onscreenclick;
exports.ontimer = ontimer;
exports.pd = pd;
exports.pen = pen;
exports.pencolor = pencolor;
exports.pendown = pendown;
exports.pensize = pensize;
exports.penup = penup;
exports.pos = pos;
exports.position = position;
exports.pu = pu;
exports.radians = radians;
exports.register_shape = register_shape;
exports.reset = reset;
exports.resetscreen = resetscreen;
exports.resizemode = resizemode;
exports.right = right;
exports.rt = rt;
exports.screensize = screensize;
exports.setDefaultScreen = setDefaultScreen;
exports.setDefaultTurtle = setDefaultTurtle;
exports.seth = seth;
exports.setheading = setheading;
exports.setpos = setpos;
exports.setposition = setposition;
exports.setundobuffer = setundobuffer;
exports.setup = setup;
exports.setworldcoordinates = setworldcoordinates;
exports.setx = setx;
exports.sety = sety;
exports.shape = shape;
exports.shapesize = shapesize;
exports.showturtle = showturtle;
exports.st = st;
exports.stamp = stamp;
exports.teleport = teleport;
exports.textinput = textinput;
exports.tilt = tilt;
exports.tiltangle = tiltangle;
exports.title = title;
exports.towards = towards;
exports.tracer = tracer;
exports.turtles = turtles;
exports.turtlesize = turtlesize;
exports.undo = undo;
exports.undobufferentries = undobufferentries;
exports.up = up;
exports.update = update;
exports.width = width;
exports.window_height = window_height;
exports.window_width = window_width;
exports.write = write;
exports.xcor = xcor;
exports.ycor = ycor;

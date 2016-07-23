/*globals _:false */
'use strict';
var connect4;
(function() {//to avoid leaking global variablles, a common truck in javascript
    function Point(_x, _y) {
        if (this===undefined)
            alert('undfined')
        this.x = Number(_x || 0);
        this.y = Number(_y || 0);
    }
    Object.prototype.toString = function() {
        return JSON.stringify(this);
    };    
    function other_color(color){
        return color=='r'?'y':'r';
    }    
    function Timer() { //to measure elapsed time, usefull for smooth animation
        var last_time = get_cur_time();
        function get_cur_time() {
            return new Date().getTime() / 1000;
        }
        this.elapsed=function(){
            var cur_time=get_cur_time();
            var ans= cur_time-last_time;
            last_time=cur_time;
            return ans;
        }
    }
    function Board(m,n){ //represents the positons of the pieceson the board as arrayy of strings. plus some util functions
        this.cols=[]
        this.get_cell=function get_cell(x,y){
            if (x<0||x>=n || y<0 || y>=m)
                return "o"; //for out
            if (this.cols[x].length<=y)
                return null;
            return this.cols[x][y];
        }
        this.add=function(col,color){
            this.cols[col]+=color;
        }
        this.pop=function(col){
            this.cols[col]=this.cols[col].slice(0, -1)
        }
        this.is_full=function(){
            for (var i=0;i<n;i++)
                if (this.cols[i].length<m)
                    return false;
            return true;
        }        
        this.has_connect=function (x,y,size,dirx,diry,open_only,forcolor){
            var first=this.get_cell(x,y);
            if (forcolor && forcolor!=first)
                return false
            for (var h=1;h<size;h++){
                var val=this.get_cell(x+dirx*h,y+diry*h);
                if (first!=val)
                    return false;
            }
            if (open_only){
                var b1=this.get_cell(x+dirx*size,y+diry*size);
                var b2=this.get_cell(x+dirx*-1,y+diry*-1);
                return b1===null||b2===null; //at least one of the boundey cells must be null
            }
            return true;
        }
        this.get_connects=function(size,open_only,forcolor){
            var ans=[]
            var dirs=[[1,0],[0,1],[1,1],[-1,1]]
            for (var x=0;x<n;x++)
                for (var y=0;y<m;y++){
                    if (this.get_cell(x,y)===null)
                        continue;
                    for (var h=0;h<dirs.length;h++){
                        var dir=dirs[h];
                        var dirx=dir[0];
                        var diry=dir[1];
                        if (this.has_connect(x,y,size,dirx,diry,open_only,forcolor)){
                            var line=[new Point(x,y),new Point(x+dirx*(size-1),y+diry*(size-1))];
                            ans.push(line); 
                        }
                    }
                }
            return ans;
        }
        this.toString=function(){
            var ans=''
            for (var i=0;i<n;i++){
                var col=this.cols[i];
                ans+=i+':'+this.cols[i]+'\n';  
            }
            return ans          
        }
        this.height=function(x){
            if (this.cols[x]==undefined)
                console.log('bug1');
            return this.cols[x].length;
        }    
        for (var i=0;i<n;i++)
            this.cols.push(''); //n columns of balls. initaliy they are empty
    }
    function BallAnimation(){//an isolated class to help with the ball animation
        this.is_active=false;
        this.col=null;
        this.color=null;
        this.cur_position=null;
        var end=null
        var timer=null;
        var speed=0;
        this.start=function(col,color,start,_end){
            speed=0;
            this.is_active=true;
            this.col=col;
            this.color=color;
            this.cur_position=start;
            end=_end;
            timer=new Timer()
        }
        this.animate=function(){ //returns true if all done so can apply the final changes
            if (!this.is_active)
                return false;
            var elapsed=timer.elapsed();
            speed-=elapsed*5; //cells per second
            this.cur_position+=speed;
            if (this.cur_position<=end){
                this.cur_position=end;
                this.is_active=false;
                return true;
            }
            return false;
        }
    }
    connect4 = function(canvasid,_message_cb,_init_callback) { //project a global variabl wall_widget
        var canvas = document.getElementById(canvasid);
        var timer = new Timer();
        var n=7 //numer of cols 
        var m=6 //number of board rows
        var winning_connect_size=4;
        var step=null //viaual size of the cells /
        var margin=null //visual margin of the board
        var board=new Board(m,n);
        var turn="r"
        var cpu="r"
        var animation=new BallAnimation();
        var game_result=null;//the win/lose interprtaoiin of the current board
        var message_cb=_message_cb; //called to annouce vicoty/defeat
        var init_callback=_init_callback; //called when clicking the screen before electing side
        var init_mode=true //true if user didnot choose color yet. 

        function calc_cpu_move(){ //major function: using minmax calculates the cpu next move
            var cpu_move_ans=null;//get oweritten many time during a typical run of calc_cpu_move
            function is_terminal(){
                if (board.get_connects(winning_connect_size,false).length>0)
                    return true;
                return board.is_full();
            }            
            function heuristics(){//very crude heuristics to be used with minimax
                var own_4lines=board.get_connects(winning_connect_size,false,cpu);//.length*1000 //1000 points for gryffindor for wining the game
                var own_3lines=board.get_connects(winning_connect_size-1,true,cpu);//.length*100 //100 points for almost winning
                var other_4lines=board.get_connects(winning_connect_size,false,other_color(cpu))//.length*1000
                var other_3lines=board.get_connects(winning_connect_size-1,true,other_color(cpu))//.length*100;
                var ans=own_4lines.length*1000+own_3lines.length*100-other_4lines.length*1000-other_3lines.length*100;         
                return ans
            } 
            function minimax(depth, maximizingPlayer){
                 if (depth == 0 || is_terminal())
                    return heuristics()*(depth+5); //mutiply by depth+5 to give higher value to events that happens soonser - bug fix of unclever behavoir of the ai
                 if (maximizingPlayer){
                     var best=-100000;
                     for (var i=0;i<n;i++){
                        if (board.height(i)>=m)
                            continue;
                        board.add(i,cpu)
                        var move_ans = minimax(depth-1,false);
                        if (best<move_ans){
                            best=move_ans
                            cpu_move_ans=i
                        }
                        board.pop(i)
                    }
                    return best
                }else{
                     var best=+100000;
                     for (var i=0;i<n;i++){
                        if (board.height(i)>=m)
                            continue;                    
                        board.add(i,other_color(cpu))
                        var move_ans = minimax(depth-1,true);
                        if (best>move_ans){
                            best=move_ans;
                            cpu_move_ans=i;
                        }
                        board.pop(i)
                    }
                    return best
                }
            }
            minimax(4,true); //change the value to increase intelegenc 
            return cpu_move_ans;
        }
        function calc_game_result(){ 
        //small util function that uses the board util function to clculate the currnt game reult. 
        //for ongoing game the reuslt is null
            var won_color=null
            var lines=board.get_connects(winning_connect_size,false)
            if (lines.length>0){
                var p=lines[0][0];
                won_color=board.get_cell(p.x,p.y)
            }          
            if (won_color){
                if (cpu==won_color)
                    return "You lost";
                else
                    return "You won";
            }
            if (board.is_full())
                return "Draw"
            return null
        }
        function cpu_plays_if_its_turn(){
            if (turn==cpu && !game_result)
                drop_ball(calc_cpu_move(),turn);
        }
        function animate() { //called every 30 ms, animate the falling ball 
            if (animation.animate()){
                //if got here, then the animation is done and we can put the ball in its resting place
                board.add(animation.col,animation.color);
                turn=other_color(turn);
                game_result=calc_game_result();
                if (game_result){//game rault is available, announce it using the mmessage_cb that was injected to this module on init (by the index.html)
                    message_cb(game_result);
                    return;
                }
                cpu_plays_if_its_turn();
            }
        }
        function point_from_event(event) {
            var rect = canvas.getBoundingClientRect();
            return new Point((event.clientX - rect.left)/.9, (event.clientY - rect.top)/.9); // division by .9 is black margic workaround. the value must be the sams as in the css
        }
        function drop_ball(column,color){
            animation.start(column,color,m,board.height(column));
        }
        function mousedown(event) {
            if (init_mode){ //if user has not choosen color
                init_callback();
                return;
            }
            if (animation.is_active || game_result) //disable moouse input for ball is droping or is the game is done (game_result is known)
                return;
            var click_point=point_from_event(event);
            var click_cell=wnd_to_grid(click_point.x,click_point.y);
            if (!click_cell)
                return
            if (board.height(click_cell.x)>=m)
                return; //no room to add another ball
            drop_ball(click_cell.x,turn);
        }
        function wnd_to_grid(x,y){
            return new Point(Math.floor((x-margin)/step),m-Math.floor((y-margin)/step)-1);
        }
        function grid_point_to_wnd(offset){ //given grid coord, return top left point
            function ans(p){
                return new Point(margin+(p.x+offset)*step,margin+(m-(p.y+offset))*step+offset);
            }
            return ans;
        }
        function grid_to_wnd(x,y){ //given grid coord, return top left point
            return new Point(margin+x*step,margin+(m-y)*step);
        }
        function draw() { //draw the current state, called every 30 ms and draws to entire board on the canvas
            var ctx;
            function draw_line(a,b){
                ctx.beginPath();
                ctx.moveTo(a.x,a.y);
                ctx.lineTo(b.x,b.y);
                ctx.stroke();
            }
            function draw_ball(x,y,radius,fillStyle){
                ctx.fillStyle = fillStyle;
                ctx.beginPath();
                ctx.arc(x,y, radius, 0, 2 * Math.PI, true);
                ctx.fill();                
            }
            function draw_grid(){
                //ctx.setLineDash([3, 3]); //which look better dashed lines or solid lines?
                var f=grid_to_wnd;
                for (var i=0;i<=n;i++)
                    draw_line(f(i,0),f(i, m));
                for (var i=0;i<=m;i++)
                    draw_line(f(0,i),f(n,i));      
            }
            function draw_ball_by_cell(cell,color){
                if (!cell)
                    return;
                var p=grid_to_wnd(cell.x,cell.y);
                var hs=step/2;//aka halp step
                if (color=='r')
                    color="red";//rgba(200, 0, 0, 0.8)";
                if (color=='y')
                    color="yellow";//(255, 250, 100, 0.8)";
                draw_ball(p.x+hs,p.y-hs,hs*.7,color);
            }
            function set_drop_shadow(){
                ctx.shadowColor = "black";
                ctx.shadowOffsetX = 2; 
                ctx.shadowOffsetY = 2; 
                ctx.shadowBlur = 5;
            }
            function draw_fixed_balls(){
                for (var i=0;i<n;i++)
                    for (var j=0;j<board.height(i);j++)
                        draw_ball_by_cell(new Point(i,j),board.get_cell(i,j));
            }
            function draw_animated_ball(){
                if(!animation.is_active)
                    return;
                var cell=new Point(animation.col,animation.cur_position)
                draw_ball_by_cell(cell,animation.color);
            }
            function draw_connects(){ 
                //draw the final connects of size 4 (aka winning_connect_size) and also 3 - to visiualize impending doom
                var test_size=winning_connect_size-1; 
                var open_only=true;
                if (game_result){
                    test_size=winning_connect_size;
                    open_only=false;
                }
                var lines=board.get_connects(test_size,open_only)
                ctx.setLineDash([3, 3]);
                ctx.strokeStyle = 'white';
                ctx.lineWidth=3;    
                for (var i=0;i<lines.length;i++){
                    var line=lines[i]
                    var f=grid_point_to_wnd(.5);
                    draw_line(f(line[0]),f(line[1]));
                }
            }
            function init_draw(){
                ctx = canvas.getContext("2d");
                ctx.canvas.width = window.innerWidth;
                ctx.canvas.height = window.innerHeight;
                var max_size=Math.max(canvas.width, canvas.height);
                var margin_percent=1;
                margin=2*margin_percent*max_size/100;   
                step=Math.min((ctx.canvas.width-margin*2)/n,(ctx.canvas.height-margin*2)/m);       
            }
            if(!canvas.getContext) return;
            init_draw();
            draw_grid();
            set_drop_shadow(); 
            draw_fixed_balls()
            draw_animated_ball()
            draw_connects();
        }
        function animate_and_draw(){
            animate();
            draw();
        }
        function new_game(player_color){
            init_mode=false;
            board=new Board(m,n);
            game_result=null;
            turn='r'
            cpu=other_color(player_color);
            cpu_plays_if_its_turn();
        }
        function attach_handlers() {
            canvas.addEventListener("mousedown", mousedown, false);
            canvas.addEventListener("touchmove",function(evt){evt.preventDefault();});//avoid confusing behaviur on touch screens
            setInterval(animate_and_draw, 30);
        }
        attach_handlers();
        return {new_game:new_game}
    }
})();

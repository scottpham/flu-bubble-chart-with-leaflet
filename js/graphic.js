var $map = $('#map');

var circleSize = 70;

var colors = {
    'red1': '#6C2315', 'red2': '#A23520', 'red3': '#D8472B', 'red4': '#E27560', 'red5': '#ECA395', 'red6': '#F5D1CA',
    'orange1': '#714616', 'orange2': '#AA6A21', 'orange3': '#E38D2C', 'orange4': '#EAAA61', 'orange5': '#F1C696', 'orange6': '#F8E2CA',
    'yellow1': '#77631B', 'yellow2': '#B39429', 'yellow3': '#EFC637', 'yellow4': '#F3D469', 'yellow5': '#F7E39B', 'yellow6': '#FBF1CD',
    'teal1': '#0B403F', 'teal2': '#11605E', 'teal3': '#17807E', 'teal4': '#51A09E', 'teal5': '#8BC0BF', 'teal6': '#C5DFDF',
    'blue1': '#28556F', 'blue2': '#3D7FA6', 'blue3': '#51AADE', 'blue4': '#7DBFE6', 'blue5': '#A8D5EF', 'blue6': '#D3EAF7'
};

/*
 * Render the graphic
 */
//check for svg
function draw_graphic(){
    if (Modernizr.svg){
        $map.empty();
        var width = $map.width();
        render(width);
        //window.onresize = draw_graphic; //very important! the key to responsiveness
    }
}


function render(width) {

 //leaflet stuff

    //make a map                        
    var map = new L.Map("map", {
        center: [37.77, -122.42],
        zoom: 7,
        scrollWheelZoom: false}) //lat, long, not long, lat
        .addLayer(new L.TileLayer("http://api.tiles.mapbox.com/v4/nbclocal.k38kb5c1/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibmJjbG9jYWwiLCJhIjoiS3RIUzNQOCJ9.le_LAljPneLpb7tBcYbQXQ"));

    //add an svg to the overlay pane
    var svg = d3.select(map.getPanes().overlayPane).append("svg"),
        g = svg.append("g").attr("class", "leaflet-zoom-hide");

    //get data
    queue()
        .defer(d3.json, "counties.json")
        .defer(d3.csv, "flu_percent_unused.csv")
        .await(ready);

    var fluByCounty = {};
    var vacByCounty = {};

    function ready(error, ca, flu){

        ////////a bunch of non geo related stuff//////
        //maps county names to flu percentage
        flu.forEach(function(d) { 
            fluByCounty[d.county] = +d.percent_unused;});
        
        //map county names to average vaccines
         flu.forEach(function(d) {
            vacByCounty[d.county] = +d.total;});
        
        //max for color scale
        var max = d3.max(flu, function(d) { return +d.percent_unused; });

        //threshold scale for key and circles
        var color = d3.scale.threshold() //colorscale
            .domain([.1, .2, .3, .4])
            .range(colorbrewer.Blues[4]);
            
        //shorthand for accessing topo data    
        var mapData = topojson.feature(ca, ca.objects.subunits);
        //attach data to circle areas
        var areas = mapData.features.map(
            function(d) {return vacByCounty[d.properties.name];})

        ////////end non geo related stuff////////


        //create a path to convert geojson to svg
        var transform = d3.geo.transform({point: projectPoint}),
            path = d3.geo.path().projection(transform);

        //data join to create paths for each feature
        var feature = g.selectAll("path")
                .data(mapData.features)
            .enter().append("path");

        //add subunits to overlay class
        feature
            .attr("class", function(d) { return "subunit " + d.properties.name; });

        //append another path to overlay and make it the exterior
        g.append("path")
            .datum(topojson.mesh(ca, ca.objects.subunits, function(a, b) { return a === b;}))
            .attr("d", path)
            .attr("class", "exterior-boundary");

         //tooltip declaration
        var div = d3.select("#map").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        //format for tooltip
        var percentFormat = function(d){
            if (d) { return (d3.format(".1%"))(d) }
            else { return "N/A"}
            }

        //format for # of vaccines
        var commaFormat = d3.format(",f")

        //define tip
        var tip = d3.tip()
            .attr("class", 'd3-tip')
            .offset([-10, 0])
            .html(function(d) { return "<p>" + d.properties.fullName + "</p><p>% Unused: " + percentFormat(fluByCounty[d.properties.name]) + "</p><p># Vaccines Available: " + commaFormat(vacByCounty[d.properties.name]) + "</p>"});

        g.call(tip);



        //circles
        g.append("g")
              .attr("class", "circles")
            .selectAll("circle")
                  .data(topojson.feature(ca, ca.objects.subunits).features)
                .enter().append("circle")
                //necessary attributes are filled by reset function below
            .style("fill", function(d){ 
                return color(fluByCounty[d.properties.name]);
              })
                .on("mouseover", tip.show)
                .on("mouseout", tip.hide);  


        //fix on zoom
        map.on("viewreset", reset);
        reset();

        ///////reposition SVG to cover the features/////
        function reset(){ 
            //define bounds of path features
            var bounds = path.bounds(mapData),
                topLeft = bounds[0],
                bottomRight = bounds[1];

            //define width of svg
            svgWidth = bottomRight[0] - topLeft[0];

            // console.log(svgWidth);

            //define circle size as a portion of svg width
            circleSize = 0.07 * svgWidth;
            minCircleSize = .07 * circleSize;

            //        //scale for circle
            var scale = d3.scale.sqrt()
                .domain(d3.extent(areas))
                .range([minCircleSize, circleSize]);

            //set svg position
            svg.attr("width", svgWidth)
                .attr("height", bottomRight[1] - topLeft[1])
                .style("left", topLeft[0] + "px")
                .style("top", topLeft[1] + "px");

            g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

            //initialize the path data by setting d
            feature.attr("d", path);

            //select the exterior boundary and reset it
            g.select(".exterior-boundary").attr("d", path);

            g.selectAll("circle")
              .data(mapData.features)
                .attr("transform", function(d) { return 'translate(' + path.centroid(d) + ')';})
                .attr("r", function(d) { return scale(vacByCounty[d.properties.name]); });

        }//end of reset


        ///////threshold key//////
    
    //define scales
    var y = d3.scale.linear()
        .domain([0, max]) //input data
        .range([0, width/4]); //height of the key

    //define a second svg for the key and attach it to the map div
    var legend = d3.select("#map").append("svg")
        .attr("width", "300")
        .attr("height", "500")
        ;

    //create group for color bar and attach to second svg
    var colorBar = legend.append("g")
        .attr("class", "key")
        .attr("transform", "translate(15, 90)")
        .selectAll("rect")
        .data(color.range().map(function(col) {
            var d = color.invertExtent(col);
            if (d[0] == null) d[0] = y.domain()[0];
            if (d[1] == null) d[1] = y.domain()[1];
            return d;
        }));

    //create color rects
    colorBar.enter()
        .append("rect")
            .attr("width", 15)
            .attr("y", function(d) { 
                return y(d[0]); })
            .attr("height", function(d) { return y(d[1]) - y(d[0]); })
            .attr("fill", function(d) { return color(d[0]); });

    //get array of legend domain
    var colorDomain = color.domain();

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("right")
        .tickSize(16)
        .tickValues([colorDomain[0], colorDomain[1], colorDomain[2], colorDomain[3]])
        .tickFormat(percentFormat);

    //console.log(format(max));


    d3.select(".key")
        .call(yAxis)


    div.class

    //add label
    d3.select(".key")
        .call(yAxis)
        .append("text")
        .attr("y", -3)
        //.attr("x", -30)
        .attr("class", "label")
        .text("Vaccine Left Over")
        ;



        //Leaflet implements the geometric transformation
        function projectPoint(x, y) {
            var point = map.latLngToLayerPoint(new L.LatLng(y, x));
            this.stream.point(point.x, point.y);
        }

    }//end of ready
}//end of render


/*
 * NB: Use window.load instead of document.ready
 * to ensure all images have loaded
 */
$(window).load(function() {
    draw_graphic();
});







(function($) {
    "use strict";

    var forceDirected;

    function buildGraph(me, friends, mutualFriends) {
        var labelType, useGradients, nativeTextSupport, animate;
        var ua = navigator.userAgent,
            iStuff = ua.match(/iPhone/i) || ua.match(/iPad/i),
            typeOfCanvas = typeof HTMLCanvasElement,
            nativeCanvasSupport = (typeOfCanvas == 'object' || typeOfCanvas == 'function'),
            textSupport = nativeCanvasSupport && (typeof document.createElement('canvas').getContext('2d').fillText == 'function');

        //I'm setting this based on the fact that ExCanvas provides text support for IE
        //and that as of today iPhone/iPad current text support is lame
        labelType = (!nativeCanvasSupport || (textSupport && !iStuff)) ? 'Native' : 'HTML';
        nativeTextSupport = labelType == 'Native';
        useGradients = nativeCanvasSupport;

        var friendsToMe = _.map(friends.data, function(friend) {
            return {
                "nodeTo": friend.id,
                "nodeFrom": me.id,
                "data": {
                    "$color": "#557eaa"
                }
            };
        });
        var meToFriends = _.map(friends.data, function(friend) {
            return {
                "adjacencies": [{
                    "nodeTo": me.id,
                    "nodeFrom": friend.id,
                    "data": {
                        "$color": "#557EAA"
                    }
                }],
                "data": {
                    "$color": "#83548B",
                    "$type": "circle",
                    "$dim": 10
                },
                "id": friend.id,
                "name": friend.name
            };
        });
        var json = meToFriends;
        json.push({
            "adjacencies": [
            friendsToMe],
            "data": {
                "$color": "#83548B",
                "$type": "circle",
                "$dim": 10
            },
            "id": me.id,
            "name": me.name
        });
        forceDirected = new $jit.ForceDirected({
            //id of the visualization container
            injectInto: 'infovis',
            //Enable zooming and panning
            //by scrolling and DnD
            Navigation: {
                enable: true,
                //Enable panning events only if we're dragging the empty
                //canvas (and not a node).
                panning: 'avoid nodes',
                zooming: 10 //zoom speed. higher is more sensible
            },
            // Change node and edge styles such as
            // color and width.
            // These properties are also set per node
            // with dollar prefixed data-properties in the
            // JSON structure.
            Node: {
                overridable: true
            },
            Edge: {
                overridable: true,
                color: '#23A4FF',
                lineWidth: 0.4
            },
            //Native canvas text styling
            Label: {
                type: labelType, //Native or HTML
                size: 10,
                style: 'bold'
            },
            //Add Tips
            Tips: {
                enable: true,
                onShow: function(tip, node) {
                    //count connections
                    var count = 0;
                    node.eachAdjacency(function() {
                        count++;
                    });
                    //display node info in tooltip
                    tip.innerHTML = "<div class=\"tip-title\">" + node.name + "</div>" + "<div class=\"tip-text\"><b>connections:</b> " + count + "</div>";
                }
            },
            // Add node events
            Events: {
                enable: true,
                type: 'Native',
                //Change cursor style when hovering a node
                onMouseEnter: function() {
                    forceDirected.canvas.getElement().style.cursor = 'move';
                },
                onMouseLeave: function() {
                    forceDirected.canvas.getElement().style.cursor = '';
                },
                //Update node positions when dragged
                onDragMove: function(node, eventInfo, e) {
                    var pos = eventInfo.getPos();
                    node.pos.setc(pos.x, pos.y);
                    forceDirected.plot();
                },
                //Implement the same handler for touchscreens
                onTouchMove: function(node, eventInfo, e) {
                    $jit.util.event.stop(e); //stop default touchmove event
                    this.onDragMove(node, eventInfo, e);
                },
                //Add also a click handler to nodes
                onClick: function(node) {
                    if (!node) return;
                    // Build the right column relations list.
                    // This is done by traversing the clicked node connections.
                    var html = "<h4>" + node.name + "</h4><b> connections:</b><ul><li>",
                        list = [];
                    node.eachAdjacency(function(adj) {
                        list.push(adj.nodeTo.name);
                    });
                    //append connections information
                    //$jit.id('inner-details').innerHTML = html + list.join("</li><li>") + "</li></ul>";
                }
            },
            //Number of iterations for the FD algorithm
            iterations: 200,
            //Edge length
            levelDistance: 430,
            // Add text to the labels. This method is only triggered
            // on label creation and only for DOM labels (not native canvas ones).
            onCreateLabel: function(domElement, node) {
                domElement.innerHTML = node.name;
                var style = domElement.style;
                style.fontSize = "0.8em";
                style.color = "#ddd";
            },
            // Change node styles when DOM labels are placed
            // or moved.
            onPlaceLabel: function(domElement, node) {
                var style = domElement.style;
                var left = parseInt(style.left);
                var top = parseInt(style.top);
                var w = domElement.offsetWidth;

                style.left = (left - w / 2) + 'px';
                style.top = (top + 10) + 'px';
                style.display = '';
            }
        });
        // load JSON data.
        forceDirected.loadJSON(json);
        // compute positions incrementally and animate.
        forceDirected.computeIncremental({
            iter: 40,
            property: 'end',
            onStep: function(perc) {
                //Log.write(perc + '% loaded...');
            },
            onComplete: function() {
                //Log.write('done');
                forceDirected.animate({
                    modes: ['linear'],
                    transition: $jit.Trans.Elastic.easeOut,
                    duration: 2500
                });
            }
        });
    }

    function getFriends() {
        var deferred = new jQuery.Deferred();

        FB.api('/me/friends', function(response) {
            deferred.resolve(response);
        });

        return deferred.promise();
    }

    function getMutualFriends(friends) {
        var x, friend;

        console.log('Fetching mutual friends');

        for (x = 0; x < friends.data.length; x++) {
            friend = friends.data[x];

            (function(friend) {
                FB.api('/me/mutualfriends/' + friend.id, function(mutualFriends) {
                    var y, mutualFriend, to, from = forceDirected.graph.getNode(friend.id);

                    for (y = 0; y < mutualFriends.data.length; y++) {
                        mutualFriend = mutualFriends.data[y];

                        to = forceDirected.graph.getNode(mutualFriend.id);
                        forceDirected.graph.addAdjacence(from, to);
                    }
                });
            })(friend);
        }

        console.log('Finished fetching mutual friends. Graphing...');

        forceDirected.computeIncremental({
            iter: 40,
            property: 'end',
            onStep: function(perc) {
                //Log.write(perc + '% loaded...');
            },
            onComplete: function() {
                //Log.write('done');
                forceDirected.animate({
                    modes: ['linear'],
                    transition: $jit.Trans.Elastic.easeOut,
                    duration: 2500
                });
            }
        });
    }

    $.ajaxSetup({
        cache: true
    });
    $.getScript('//connect.facebook.net/en_UK/all.js', function() {
        FB.init({
            appId: '543316639050180',
            channelUrl: 'channel.html',
        });

        $('#loginbutton,#feedbutton').removeAttr('disabled');
        FB.login(function(response) {
            if (response.authResponse) {
                console.log('Fetching your information.... ');

                FB.api('/me', function(response) {
                    getFriends().then(function(friends) {
                        buildGraph(response, friends);
                        getMutualFriends(friends);
                    });
                }, {
                    scope: 'read_friendlists,user_location,friends_location'
                });
            }
        });
    });

    $(document).ready(function() {
        $('#btnLayout').click(function() {
            forceDirected.computeIncremental({
                iter: 40,
                property: 'end',
                onStep: function(perc) {
                    //Log.write(perc + '% loaded...');
                },
                onComplete: function() {
                    //Log.write('done');
                    forceDirected.animate({
                        modes: ['linear'],
                        transition: $jit.Trans.Elastic.easeOut,
                        duration: 2500
                    });
                }
            });
        });
    });
}(jQuery));
location.hash = "";

var color = {
    "blue"  : "#3388cc",
    "red"   : "#B7110A",
    "black" : "#000",
    "gray"  : "#666",
    "white" : "#fff",
    "gold"  : "#FFE85F", //"gold radial-gradient(lightyellow, gold)",
};

function getTask () {
    return tasks.current;
}

function fadeMessage (str) {
    $("<div class='ui-loader ui-overlay-shadow ui-body-a ui-corner-all'> " + str + "</div>")
        .css({ "display": "block", "opacity": 0.96, "width":"50%", "top": "40%", "left" : "25%", "padding":"0 5px", "text-align":"center"})
        .appendTo( $.mobile.pageContainer )
        .delay( 1500 )
        .fadeOut( 400, function() {
            $(this).remove();
        });
}

var tasks = {
    "new" : function (title, desc, state, hold, persist) {
        var task = {
            title : title,
            description : desc,
            state : state||"Open",
            created : (new Date()).getTime(),
            modified : (new Date()).getTime(),
            hold : hold||{
                start : null,
                duration : null,
            },
            persist : persist||{
                start : null,
                duration : null,
            },
            display : tasks._display,
        };
        this.list.push(task);
        this.save();
        return task;
    },
    "delete" : function (task) {
        var index = this.list.lastIndexOf(task);
        if (index != -1) {
            this.list.splice(index, 1);
        }
        this.save();
    },
    "edit" : function (task, title, desc, state, hold, persist) {
        var t = task||this.current;
        if (title)
            t.title = title;
        if (desc)
            t.description = desc;
        if (state)
            t.state = state;
        if (hold)
            t.hold = hold;
        if (persist)
            t.persist = persist;
        t.modified = (new Date()).getTime();
        this.save();
    },
    "get" : function (query) {
        var rows = [];
        var i = this.list.length;
        while (i--) {
            var row = this.list[i];
            if (query(row)) {
                rows.push(row);
            }
        }
        return rows;
    },
    "list" : [],
    "save" : function () {
        window.localStorage.setItem("tasks", JSON.stringify(this.list));
    },
    "load" : function () {
        var list = JSON.parse(window.localStorage.getItem("tasks"));
	    if (list != null) {
            this.list = list;
        }
    },
    "checkHolds" : function () {
        var l = this.get(function (row) { // get all holds
            return (row.state == "On Hold")?true:false;
        });
        var change = false;
        for (var i=0;i<l.length;i++) {
            if (this.holdIsOver(l[i])) { // check them
                this.edit(l[i], null, null, "Open"); // edit the ones that are passed hold time
                change = true;
            }
        }
        return change;
    },
    // returns true if this task shouldn't be on hold
    "holdIsOver" : function (t) {
        var start = new Date(t.hold.start);
        var now = new Date();
        var num = parseInt(t.hold.duration.substr(1));
        var unit = t.hold.duration.substr(0,1);
        switch (unit) {
            case "H": // hours
                //start.setHours(start.getHours()+(start.getMinutes()>30?1:0), 0, 0, 0);
                num *= 1000*60*60;
                break;
            case "D": // days
                //start.setDate(start.getDate()+(start.getHours()<4?-1:0));
                start.setHours(0, 0, 0, 0);
                num *= 1000*60*60*24;
                break;
            case "W": // weeks
                //start.setDate(start.getDate()+(start.getHours()<4?-1:0));
                start.setHours(0, 0, 0, 0);
                num *= 1000*60*60*24*7;
                break;
            case "M": // months
                start.setMonth(start.getMonth()+num);
                start.setHours(0, 0, 0, 0);
                num = 0;
                break;
            case "Y": // years
                start.setFullYear(start.getFullYear()+num);
                start.setHours(0, 0, 0, 0);
                num = 0;
                break;
            case "I": // infinite
                return false;
        }
        return start.getTime() + num < now.getTime();
    },
    "checkPersists" : function () {
        var l = this.get(function (row) { // get all persists
            return (row.state == "Complete" && row.persist.start != null)?true:false;
        });
        var change = false;
        var now = (new Date()).getTime();
        for (var i=0;i<l.length;i++) {
            var reopen = this.PersistReopenAt(l[i])
            while (reopen < now) { // check them
                var p = {
                    start : reopen,
                    duration : l[i].persist.duration,
                };
                this.edit(l[i], null, null, "Open", null, p);
                change = true;

                reopen = this.PersistReopenAt(l[i])
            }
        }
        return change;
    },
    // returns true if this task shouldn't be on hold
    "PersistReopenAt" : function (t) {
        var start = new Date(t.persist.start);
        var num = parseInt(t.persist.duration.substr(1))||1;
        var unit = t.persist.duration.substr(0,1);
        switch (unit) {
            case "H": // hours
                num *= 1000*60*60;
                break;
            case "D": // days
                start.setHours(0, 0, 0, 0);
                num *= 1000*60*60*24;
                break;
            case "W": // weeks
                start.setHours(0, 0, 0, 0);
                num *= 1000*60*60*24*7;
                break;
            case "M": // months
                start.setMonth(start.getMonth()+num);
                start.setHours(0, 0, 0, 0);
                num = 0;
                break;
            case "Y": // years
                start.setFullYear(start.getFullYear()+num);
                start.setHours(0, 0, 0, 0);
                num = 0;
                break;
            default: // prevents infinite loops
                return start.getTime() + 100000*60*60*24;
        }
        return start.getTime() + num;
    },

    "init" : function () {
        this.load();
    },
    "current" : null,
};


/***********************/
/* list page functions */
/***********************/

// display list
function displayList(cat) {
    var hash = {
        "Open" : 1,
        "On Hold" : 2,
        "Completed" : 3
    };

    cat = cat||window.localStorage.getItem("cat");
    window.localStorage.setItem("cat", cat);
    window.localStorage.setItem("nid", hash[cat]);

    tasks.checkHolds();
    tasks.checkPersists();

    var list = $('#current');
    list.html("");
    var l = tasks.list;
    var i = l.length;
    while (i--) {
        var t = l[i];
        if (t.state == cat) {
            var a = $('<a href="#taskPage">' + t.title + '</a>');
            a[0].task = t;
            a[0].index = i;
            var li = $('<li></li>').append(a.click(function () {displayTask(this.task);}));
            list.append(li).listview('refresh');
        }
    }
    list.filterable( "refresh" );
}

// enable or disable drag sort of list
function toggleSort() {
    if ($("#sortable").is(":checked")) {
        $("#current").sortable( "option", "disabled", false );
    } else {
        $("#current").sortable( "option", "disabled", true );
    }
    $("#sortable").checkboxradio("refresh");
}

/***********************/
/* task page functions */
/***********************/

// display a task
function displayTask(task) {
    var task = task||getTask();
    $("#dtitle").html(task.title);
    $("#state").html(task.state);
    $("#dcontent").html(toDisp(task.description));
    $("#created").html((new Date(task.created).toDateString()));
    $("#modified").html((new Date(task.modified).toDateString()));
    if (task.state == "Open") {
        $("#btnHold").html("Hold").attr("href", "#popupHold");
        $("#btnComp").html("Complete").attr("href", "#popupComplete");
        $("#holdInfo").html("");
        $("#state").parent().css({"color":"white", "background" : color.blue});
    }
    if (task.state == "On Hold") {
        $("#btnHold").html("End Hold").attr("href", "#popupEndHold");
        $("#btnComp").html("Complete").attr("href", "#popupComplete");
        $("#holdInfo").html("<hr />Hold Start: " + ((new Date(task.hold.start).toDateString())) + "<br />Hold Duration: " + task.hold.duration);
        $("#state").parent().css({"color":"white", "background" : color.gray});
    }
    if (task.state == "Completed") {
        $("#btnHold").html("Hold").attr("href", "#popupHold");
        $("#btnComp").html("Reopen").attr("href", "#popupReopen");
        $("#holdInfo").html("");
        $("#state").parent().css({"color":"black", "background" : color.gold});
    }
    if (task.persist.start) {
        $("#persistInfo").html("<hr />Persist Start: " + ((new Date(task.persist.start).toDateString())) + "<br />Persist Interval: " + task.persist.duration);
    } else {
        $("#persistInfo").html("");
    }
    tasks.current = task;
}

// if a task's checkbox is checked or unchecked
function onCheckboxChange () {
    var task = getTask();
    if (task != null) {
        task.description = fromDisp(document.getElementById("dcontent"));
        tasks.save();
    }
}

// convert a task's description into display format
function toDisp (str) {
    str = str.replace(/<[^>]*>/g, ''); // remove html tags
    str = str.replace(/---\n/g, '<hr />');
    str = str.replace(/\n/g, '<br />');
    str = str.replace(/\[]/g, '<input type="checkbox" onchange="onCheckboxChange()" />');
    str = str.replace(/\[x]/gi, '<input type="checkbox" onchange="onCheckboxChange()" checked>');
    return str;
}

// convert a task's decription into text format
function fromDisp (dom) {
    var str = dom.innerHTML;
    str = str.replace(/<br ?\/?>/gi, '\n')
    str = str.replace(/<hr ?\/?>/gi, '---\n')
    str = str.split(/<input [^>]*>/gi);
    for (var i=0;i<str.length;i++) {
       str[i] = str[i].replace(/<[^>]*>/g, ''); // remove all remaining html tags
    }

    var ret = "";
    var checkboxes = dom.getElementsByTagName("input");
    for (var i=0;i<checkboxes.length;i++) {
        ret += str[i] + (checkboxes[i].checked?"[x]":"[]");
    }
    ret += str[str.length-1];
    return ret;
}

/***************************/
/* New/Edit page functions */
/***************************/

// Set up New/Edit page to edit the current task
function setEdit() {
    var task = getTask();
    $("#estats").show();
    $("#etitle").val(task.title);
    $("#econtent").val(task.description);
    if (task.persist.start) {
        $("#epersist").prop("checked", true);
        $("#eptoggle").show();
        var start = new Date(task.persist.start);
        $("#epdate").val((start.getMonth()+1) + '/' + start.getDate() + '/' + start.getFullYear());
        $("#epersistValue").val(task.persist.duration.substr(1));
        $("#epersistType").val(task.persist.duration.substr(0,1));
    } else {
        $("#epersist").attr("checked", false);
        $("#eptoggle").hide();
        var now = new Date();
        $("#epdate").trigger('datebox', {'method':'set', 'value':(now.getMonth()+1) + '/' + now.getDate() + '/' + now.getFullYear()});
        $("#epersistValue").val("1");
        $("#epersistType").val("D");
    }
    $('#editFooter')[0].onclick = function () {getEdit();};
    $("#epersist").checkboxradio("refresh");
}

// Set up New/Edit page to creat a new task
function setNew () {
    $("#epersist").attr("checked", false);
    $("#etitle").val("");
    $("#econtent").val("");
    $("#eptoggle").hide();
    var now = new Date();
    $("#epdate").trigger('datebox', {'method':'set', 'value':(now.getMonth()+1) + '/' + now.getDate() + '/' + now.getFullYear()});
    $("#epersistValue").val("1");
    $("#epersistType").val("D");
    $('#editFooter')[0].onclick = function () {getNew();};
    $("#epersist").checkboxradio("refresh");
}

// save changes to an existing task
function getEdit () {
    var task = getTask();
    var date = $('#epdate').val().split('/'); // 12/21/2015
    date = new Date(parseInt(date[2], 10), parseInt(date[0], 10)-1, parseInt(date[1], 10)).getTime();
    var duration = $('#epersistType').val() + parseInt($('#epersistValue').val(), 10);
    var persist = {
        start : $('#epersist').prop('checked')?date:null,
        duration : $('#epersist').prop('checked')?duration:null,
    };
    if (task != null && typeof task.title != "undefined") {
        tasks.edit(task, $("#etitle").val(), $("#econtent").val(), null, null, persist);
    } else {
        task = tasks.new($("#etitle").val(), $("#econtent").val(), null, null, persist);
    }
    displayTask(task);
}

// create new task
function getNew () {
    var date = $('#epdate').val().split('/'); // 12/21/2015
    date = new Date(parseInt(date[2], 10), parseInt(date[0], 10)-1, parseInt(date[1], 10)).getTime();
    var duration = $('#epersistType').val() + parseInt($('#epersistValue').val(), 10);
    var persist = {
        start : $('#epersist').prop('checked')?date:null,
        duration : $('#epersist').prop('checked')?duration:null,
    };
    var task = tasks.new($("#etitle").val(), $("#econtent").val(), null, null, persist);
    displayTask(task);
}


/***************************/
/* task page buttons       */
/***************************/

// set up hold menu options
function setHold() {
    var task = getTask();
    if (task.hold.duration) {
        $("#holdValue").val(task.hold.duration.substr(1));
        $("#holdType").val(task.hold.duration.substr(0, 1));
        $("#holdType").selectmenu("refresh", true);
    } else {
        $("#holdValue").val("1");
        $("#holdType :nth-child(2)").prop("selected", true);
        $("#holdType").selectmenu("refresh", true);
    }
}

// put the current task on hold
function hold () {
    var start = new Date();
    var hold = {
        start : start.getTime(),
        duration : ("" + $("#holdType").val() + $("#holdValue").val()),
    }
    var task = getTask();
    tasks.edit(task, null, fromDisp(document.getElementById("dcontent")), "On Hold", hold);
    displayTask(task);
}

// end the hold on the current task
function endhold () {
    var task = getTask();
    tasks.edit(task, null, fromDisp(document.getElementById("dcontent")), "Open");
    displayTask(task);
}

// delete the current task
function deleting () {
    var task = getTask();
    tasks.edit(task, null, null, "Deleted");
    tasks.delete(task);
}

// complete the current task
function comp () {
    var task = getTask();
    tasks.edit(task, null, fromDisp(document.getElementById("dcontent")), "Completed");
    displayTask(task);
}

// reopen a task from completion
function reopen () {
    var task = getTask();
    tasks.edit(task, null, fromDisp(document.getElementById("dcontent")), "Open");
    displayTask(task);
}


/***************************/
/* Options page functions  */
/***************************/

function saveToFile () {
    var save = JSON.stringify({
        "tasks" : tasks.list,
    });
//    var fileName = (new Date()).toJSON().substr(0, 10) + ".txt";
    var fileName = "tasked.txt";
    var dirName = "Tasked";
    if (window.requestFileSystem && LocalFileSystem) {
        window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, fail);
        function gotFS(fileSystem) {
            var sdcard = fileSystem.root;
            sdcard.getDirectory(dirName, {create: true}, function (dir) {
                dir.getFile(fileName, {create: true, exclusive: false}, function (fileEntry) {
                    fileEntry.createWriter(function (writer) {
                        writer.write(save);
                        fadeMessage("Saved to " + dirName + "/" + fileName);
                    }, fail);
                }, fail);
            }, fail);
        }
        function fail(error) {
            fadeMessage("Error While Saving:<br /> " +error.code);
        }
    } else {
        var blob = new Blob([save], {type:'text/plain'});
        var downloadLink = document.createElement("a"); 
        downloadLink.download = fileName;
        downloadLink.innerHTML = "<br />save as text file";
        downloadLink.href = window.URL.createObjectURL(blob);
        downloadLink.onclick = function (event) {
            document.body.removeChild(event.target);
        };
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
        downloadLink.click();
    }
}

function loadFromFile () {
    function replaceData(evt) {
        var state = JSON.parse(evt.target.result);
        if (state.tasks != null) {
            tasks.list = state.tasks;
        }
        tasks.save();
        fadeMessage("Data Loaded Successfully");
        $.mobile.changePage("#indexPage");
    }
    if (window.requestFileSystem && LocalFileSystem) {
//        var fileName = (new Date()).toJSON().substr(0, 10) + ".txt";
        var fileName = "tasked.txt";
        var dirName = "Tasked";
        window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, fail);
        function gotFS(fileSystem) {
            var sdcard = fileSystem.root;
            sdcard.getDirectory(dirName, {create: true}, function (dir) {
                dir.getFile(fileName, {create: true, exclusive: false}, function (fileEntry) {
                    fileEntry.file(function (file) {
                        var reader = new FileReader();
                        reader.onloadend = replaceData;
                        reader.readAsText(file);
                    }, fail);
                }, fail);
            }, fail);
        }
        function fail(error) {
            fadeMessage("Error While Saving:<br /> " +error.code);
        }
    } else {
        var file = document.createElement("input");
        file.type="file";
        file.style.display = "none";
        file.addEventListener("change", function () {
            var fileToLoad = this.files[0];
            var fileReader = new FileReader();
            fileReader.onload = replaceData;
            fileReader.readAsText(fileToLoad, "UTF-8");
            this.parentNode.removeChild(this);
        }, false);
        document.body.appendChild(file);
        file.click();
    }
}

function deleteAll () {
    tasks.list = [];
    tasks.save();
}


/***************************/
/* Init Calls & Setup      */
/***************************/

$(document).on("pageshow", "#indexPage", function () {
    $("#n1, #n2, #n3").removeClass("ui-btn-active");
    $("#n"+window.localStorage.getItem("nid")).addClass("ui-btn-active");
    displayList();
    $("#sortable").attr('checked', false);
    $("#sortable").checkboxradio("refresh");
    $('#current').sortable( "option", "disabled", true );
});

$(document).on("pageinit", "#indexPage", function () {
    jQuery.extend(jQuery.mobile.datebox.prototype.options, {
        'overrideDateFormat': '%d.%m.%Y',
    });

    tasks.init();

    // make list sortable by dragging
    $('#current')
        .sortable({
            containment: 'parent',
            opacity: 0.6,
            disabled: true,
            update: function(event, ui) {
                var a = $('#current a');
                var start = -1;
                var end = -1;
                var up = false;

                var last = a[0].index;
                for (var i=1;i<a.length-1;i++) {
                    var current = a[i].index;
                    if (current > last) {
                        if (a[i+1].index < last) {
                            start = current;
                            end = last;
                        } else {
                            start = current;
                            for (i++;i<a.length;i++) {
                                current = a[i].index;
                                if (start > current) {
                                    i = a.length;
                                } else {
                                    last = current;
                                }
                            }
                            up = true;
                            end = last;
                        }
                        i = a.length;
                    }
                    last = current;
                }
                if (start != -1 && end != -1) {
                    var l = tasks.list;
                    if (up) {
                        l.splice(start, 0, l.splice(end, 1)[0]);
                    } else {
                        l.splice(end, 0, l.splice(start, 1)[0]);
                    }
                    displayList();
                    tasks.save();
                }
            }
        });

    // scroll the help list to display the content of the expanded entry
    $('.help-list').bind('collapsibleexpand', function (event, ui) {
        $('.help-list li').each(function (index) {
            var li = $(this);
            if (li.is("li") && li.is(".ui-collapsible") && li.is(":not(.ui-collapsible-collapsed)")) {
                if (index > 1) {
                    li.prev().prev()[0].scrollIntoView();
                }
                if (index == 1) {
                    li.parent().prev()[0].scrollIntoView();
                }
            }
        })
    });

    displayList("Open");
});

$(document).on("pagebeforehide","#taskPage",function(){ // When leaving pagetwo
    var task = getTask();
    if (task != null)
        task.description = fromDisp(document.getElementById("dcontent"));
});

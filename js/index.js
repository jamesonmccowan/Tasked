var color = {
    blue : "#3388cc",
    red : "#B7110A",
    black : "#000",
    gray : "#666",
    white : "#fff",
    gold : "#FFE85F", //"gold radial-gradient(lightyellow, gold)",
}
var started = 0;
function listSelect (cat) {
    var hash = {
        "Open" : 1,
        "On Hold" : 2,
        "Completed" : 3
    };
    started = 1;

    cat = cat||window.localStorage.getItem("cat");
    window.localStorage.setItem("cat", cat);
    window.localStorage.setItem("nid", hash[cat]);

    tasks.checkHolds();

    tasks.display(tasks.get(function (row) {
        return (row.state == cat)?true:false;
    }));
}


function getTask () {
    return tasks.current;
}

var tasks = {
    // displays the individual task
    // - is added to every task object
    _display : function () {
        tasks.current = this;
        $("#dtitle").html(this.title);
        $("#state").html(this.state);
        $("#dcontent").html(toDisp(this.description));
        $("#created").html((new Date(this.created).toDateString()));
        $("#modified").html((new Date(this.modified).toDateString()));
        if (this.state == "Open") {
            $("#btnHold").html("Hold").attr("href", "#popupHold");
            $("#btnComp").html("Complete").attr("href", "#popupComplete");
            $("#holdInfo").html("");
            $("#state").parent().css({"color":"white", "background" : color.blue});
        }
        if (this.state == "On Hold") {
            $("#btnHold").html("End Hold").attr("href", "#popupEndHold");
            $("#btnComp").html("Complete").attr("href", "#popupComplete");
            $("#holdInfo").html("<hr />Hold Start: " + ((new Date(this.hold.start).toDateString())) + "<br />Hold Duration: " + this.hold.duration);
            $("#state").parent().css({"color":"white", "background" : color.gray});
        }
        if (this.state == "Completed") {
            $("#btnHold").html("Hold").attr("href", "#popupHold");
            $("#btnComp").html("Reopen").attr("href", "#popupReopen");
            $("#holdInfo").html("");
            $("#state").parent().css({"color":"black", "background" : color.gold});
        }
        if (this.persist.start) {
            $("#persistInfo").html("<hr />Persist Start: " + ((new Date(this.persist.start).toDateString())) + "<br />Persist Interval: " + this.persist.duration);
        } else {
            $("#persistInfo").html("");
        }
    },
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
        var t = task;//this.list[index];
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
    "display" : function (rows) {
        var list = $('#current');
        list.html("");
        var i = rows.length;
        while (i--) {
            var a = $('<a href="#taskPage">' + rows[i].title + '</a>');
            a[0].task = rows[i];
            var li = $('<li></li>').append(a.click(function () {this.task.display();}));
            list.append(li).listview('refresh');
        }
    },
    "list" : [],
    "save" : function () {
        window.localStorage.setItem("tasks", JSON.stringify(this.list));
    },
    "load" : function () {
        var list = JSON.parse(window.localStorage.getItem("tasks"));
	    if (list != null) {
            this.list = list;
            for (var i=0;i<this.list.length;i++) {
                this.list[i].display = this._display;
            }
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
                start.setHours(start.getHours()+(start.getMinutes()>30?1:0), 0, 0, 0);
                num *= 1000*60*60;
                break;
            case "D": // days
                start.setDate(start.getDate()+(start.getHours()<4?-1:0));
                start.setHours(0, 0, 0, 0);
                num *= 1000*60*60*24;
                break;
            case "W": // weeks
                start.setDate(start.getDate()+(start.getHours()<4?-1:0));
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
            return (row.state != "Open" && row.persist.start != null)?true:false;
        });
        var change = false;
        var now = (new Date()).getTime();
        for (var i=0;i<l.length;i++) {
            var reopen = this.PersistReopenAt(l[i])
            if (reopen > now) { // check them
                var p = {
                    start : reopen,
                    duration : this.persist.duration,
                };
                this.edit(l[i], null, null, "Open", null, p); // edit the ones that are passed hold time
                change = true;
            }
        }
        return change;
    },
    // returns true if this task shouldn't be on hold
    "PersistReopenAt" : function (t) {
        var start = new Date(t.persist.start);
        var num = parseInt(t.persist.duration.substr(1));
        var unit = t.persist.duration.substr(0,1);
        switch (unit) {
            case "H": // hours
                start.setHours(start.getHours()+(start.getMinutes()>30?1:0), 0, 0, 0);
                num *= 1000*60*60;
                break;
            case "D": // days
                start.setDate(start.getDate()+(start.getHours()<4?-1:0));
                start.setHours(0, 0, 0, 0);
                num *= 1000*60*60*24;
                break;
            case "W": // weeks
                start.setDate(start.getDate()+(start.getHours()<4?-1:0));
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
        return start.getTime() + num;
    },

    "init" : function () {
        this.load();
    },
    "current" : null,
};

function fadeMessage (str) {
    $("<div class='ui-loader ui-overlay-shadow ui-body-a ui-corner-all'> " + str + "</div>")
        .css({ "display": "block", "opacity": 0.96, "width":"50%", "top": "40%", "left" : "25%", "padding":"0 5px", "text-align":"center"})
        .appendTo( $.mobile.pageContainer )
        .delay( 1500 )
        .fadeOut( 400, function(){
            $(this).remove();
        });
}

function onCheckboxChange () {
    var task = getTask();
    if (task != null) {
        task.description = fromDisp(document.getElementById("dcontent"));
        tasks.save();
    }
}

function toDisp (str) {
    str = str.replace(/\n/g, '<br />');
    str = str.replace(/\[]/g, '<input type="checkbox" onchange="onCheckboxChange()" />');
    str = str.replace(/\[x]/gi, '<input type="checkbox" onchange="onCheckboxChange()" checked>');
    return str;
}

function fromDisp (dom) {
    var str = dom.innerHTML;
    str = str.replace(/<br ?\/?>/gi, '\n')
    str = str.split(/<input [^>]*>/gi);

    var ret = "";
    var checkboxes = dom.getElementsByTagName("input");
    for (var i=0;i<checkboxes.length;i++) {
        ret += str[i] + (checkboxes[i].checked?"[x]":"[]");
    }
    ret += str[str.length-1];
    return ret;
}

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
    $('#editFooter').html("Edit");
}
function setNew () {
    $("#epersist").attr("checked", false);
    $("#etitle").val("");
    $("#econtent").val("");
    $("#eptoggle").hide();
    var now = new Date();
    $("#epdate").trigger('datebox', {'method':'set', 'value':(now.getMonth()+1) + '/' + now.getDate() + '/' + now.getFullYear()});
    $("#epersistValue").val("1");
    $("#epersistType").val("D");
    $('#editFooter').html("New");
}

function edit () {
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
    task.display();
}

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

function hold () {
    var start = new Date();
    var hold = {
        start : start.getTime(),
        duration : ("" + $("#holdType").val() + $("#holdValue").val()),
    }
    var task = getTask();
    tasks.edit(task, null, fromDisp(document.getElementById("dcontent")), "On Hold", hold);
    task.display();
}

function endhold () {
    var task = getTask();
    tasks.edit(task, null, fromDisp(document.getElementById("dcontent")), "Open");
    task.display();
}

function deleting () {
    var task = getTask();
    tasks.edit(task, null, null, "Deleted");
    tasks.delete(task);
}

function comp () {
    var task = getTask();
    tasks.edit(task, null, fromDisp(document.getElementById("dcontent")), "Completed");
    task.display();
}

function reopen () {
    var task = getTask();
    tasks.edit(task, null, fromDisp(document.getElementById("dcontent")), "Open");
    task.display();
}

function saveToFile () {
    var save = JSON.stringify({
        "tasks" : tasks.list,
    });
    var fileName = (new Date()).toJSON().substr(0, 10) + ".txt";
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
        var fileName = (new Date()).toJSON().substr(0, 10) + ".txt";
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

/*tasks.new("task 1", "something", "Completed");
tasks.new("task 2", "something", "On Hold");
tasks.new("task 3", "something", "Completed");
tasks.new("task 4", "something");
tasks.new("task 5", "something");
tasks.new("task 6", "something");
tasks.new("task 7", "something", "On Hold");
tasks.new("task 8", "something", "On Hold");
tasks.new("task 9", "something");
tasks.new("task 10", "something");
tasks.new("task 11", "something");
tasks.new("task 12", "something");
tasks.new("task 13", "something", "Completed");
tasks.new("task 14", "something", "Completed");
tasks.new("task 15", "something");
tasks.new("task 16", "something");
tasks.new("task 17", "something");
tasks.new("task 18", "something");
tasks.new("task 19", "something");
tasks.new("task 20", "something");*/

/*
http://jquerymobile.com/demos/1.2.0/docs/api/events.html
pageload/pagecreate/pageinit
$(document).on("pageinit", "#occasions", loaded);
*/

$(document).on("pageinit", "#indexPage", function () {
    jQuery.extend(jQuery.mobile.datebox.prototype.options, {
        'overrideDateFormat': '%d.%m.%Y',
    });

    tasks.init();
    listSelect("Open");

});
$(document).on("pageshow", "#indexPage", function () {
    $("#n"+window.localStorage.getItem("nid")).addClass("ui-btn-active");
    listSelect();
});

$(document).on("pagebeforehide","#taskPage",function(){ // When leaving pagetwo
    var task = getTask();
    if (task != null)
        task.description = fromDisp(document.getElementById("dcontent"));
});

$(document).on("pageinit", "#taskPage", function () {
    var task = getTask();
    if (task == null)
        $.mobile.changePage("#indexPage");
    else {
        task.display = tasks._display;
        task.display();
    }
});

$(document).on("pageinit", "#taskEdit", function () {
    if (started == 0)
        $.mobile.changePage("#indexPage");
    $("#epersist").checkboxradio("refresh");
});
$(document).on("pageshow", "#taskEdit", function () {
    $("#epersist").checkboxradio("refresh");
});

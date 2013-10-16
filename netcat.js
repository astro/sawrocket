var sock;

function setDisconnected() {
    $('#connect').attr('value', "Connect");
    $('#host').prop('disabled', false);
    $('#port').prop('disabled', false);
    $('#inputform').hide();
}
setDisconnected();

$('#connectform').submit(function(ev) {
    ev.preventDefault();

    if (!sock) {
	$('#stream').empty();
	var host = $('#host').val();
	var port = parseInt($('#port').val(), 10);
	sock = new TCPSocket(host, port);
	$('#connect').attr('value', "Abort");
	sock.onopen = function() {
	    $('#connect').attr('value', "Disconnect");
	    $('#host').prop('disabled', true);
	    $('#port').prop('disabled', true);
	    $('#inputform').slideDown(500);
	    sock.onmessage = function(msg) {
		var p = $('<pre class="in"></pre>');
		p.text(UTF8ArrToStr(new Uint8Array(msg.data)));
		$('#stream').append(p);
	    };
	    sock.onclose = function() {
		console.log("sock close");
		setDisconnected();
		sock = null;
	    };
	};
	sock.onerror = function(e) {
	    console.error("sock error", e.message);
	    setDisconnected();
	    sock = null;
	};
    } else {
	sock.close();
	sock = null;
	$('#connect').attr('value', "Connect");
    }
});

$('#inputform').submit(function(ev) {
    ev.preventDefault();

    if (!sock)
	return;

    var s = $('#input').val();
    var p = $('<pre class="out"></pre>');
    p.text(s);
    $('#stream').append(p);
    sock.send(strToUTF8Arr(s).buffer);
    $('#input').val("");
});

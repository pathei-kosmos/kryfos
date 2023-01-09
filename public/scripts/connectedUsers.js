const ul = document.querySelector("#connectedUsers");

function showConnectedUsers(arr) {
  ul.textContent = "";
  for (let i = 0; i < arr.length; i++) {
    const li = document.createElement("li");
    li.innerText = ` ${arr[i]}`;
    ul.append(li);
  }
}

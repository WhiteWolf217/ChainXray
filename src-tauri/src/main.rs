#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{io::{BufRead, BufReader}, process::{Command, Stdio}, os::windows::process::CommandExt};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
fn main() {
    tauri::Builder::default().setup(|app| {
        let base = app.path().resource_dir()?.join("resources");
        let mut engine = Command::new(base.join("node.exe"))
            .args(["engine/server.mjs", "--parent-pipe"])
            .current_dir(&base)
            .env("CHAINXRAY_HOME", app.path().app_local_data_dir()?.join("workspaces"))
            .creation_flags(0x08000000)
            .stdin(Stdio::piped()).stdout(Stdio::piped()).spawn()?;
        let mut url = String::new();
        BufReader::new(engine.stdout.take().unwrap()).read_line(&mut url)?;
        if !url.starts_with("http://127.0.0.1:") {
            let _ = engine.kill();
            return Err("Engine failed to start".into());
        }
        let window = WebviewWindowBuilder::new(app,"workbench",WebviewUrl::External(url.trim().parse()?))
            .title("ChainXray Desktop").inner_size(1280.0,820.0).build()?;
        let pipe = std::sync::Mutex::new(engine.stdin.take());
        window.on_window_event(move |event| {
            if matches!(event,tauri::WindowEvent::Destroyed){drop(pipe.lock().unwrap().take());}
        });
        Ok(())
    }).run(tauri::generate_context!()).expect("ChainXray desktop startup failed");
}


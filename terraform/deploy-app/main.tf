provider "helm" {
	kubernetes {
    client_certificate     = "${var.cluster_client_certificate}"
    client_key             = "${var.cluster_client_key}"
    cluster_ca_certificate = "${var.cluster_ca_certificate}"
    host                   = "${var.cluster_host}"
  }
}

resource "helm_release" "fellrace_finder_server" {
  name       = "fellrace-finder-server"
  chart      = "fellrace-finder-server"
  repository = "https://raw.githubusercontent.com/blairg/fellrace-finder-server/kubernetes_ready/k8s/fellrace-finder-server/"
  keyring    = ""
  # values     = ["${file("values.yaml")}"]

  # depends_on = [
  #   "kubernetes_secret.artifactory_docker_secret",
  # ]
}
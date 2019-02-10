# Configure the DigitalOcean Provider
provider "digitalocean" {
  token = "${var.do_token}"
}

# Create the Kubernetes Cluster
resource "digitalocean_kubernetes_cluster" "bgtest-cluster" {
  name    = "bgtest-cluster"
  region  = "lon1"
  version = "1.13.2-do.0"

  node_pool {
    name       = "worker-pool"
    size       = "s-1vcpu-2gb"
    node_count = 1
  }
}